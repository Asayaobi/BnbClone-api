import { Router } from 'express'
import db from '../db.js' // import the database connection
import jwt from 'jsonwebtoken'
const jwtSecret = process.env.JWT_SECRET
const router = Router()

router.post('/houses', async (req, res) => {
  try {
    // Validate Token
    const decodedToken = jwt.verify(req.cookies.jwt, jwtSecret)
    if (!decodedToken || !decodedToken.user_id || !decodedToken.email) {
      throw new Error('Invalid authentication token')
    }
    // Validate fields
    let {
      location,
      bedrooms,
      bathrooms,
      price_per_night,
      description,
      photos
    } = req.body
    if (
      !location ||
      !bedrooms ||
      !bathrooms ||
      !price_per_night ||
      !description ||
      !photos
    ) {
      throw new Error(
        'location, bedrooms, bathrooms, price, descriptions, and photos are required'
      )
    }
    // Validate photos
    if (!Array.isArray(photos)) {
      throw new Error('photos must be an array')
    }
    if (!photos.length) {
      throw new Error('photos array cannot be empty')
    }
    if (!photos.every((p) => typeof p === 'string' && p.length)) {
      throw new Error('all photos must be strings and must not be empty')
    }
    // Create house
    let houseCreated = await db.query(`
      INSERT INTO houses (location, bedrooms, bathrooms, price_per_night, description, host_id)
      VALUES ('${location}', '${bedrooms}', '${bathrooms}', '${price_per_night}', '${description}', '${decodedToken.user_id}') 
      RETURNING *
    `)
    let house = houseCreated.rows[0]
    // Create photos
    let photosQuery = 'INSERT INTO pictures (pic_url, house_id) VALUES '
    photos.forEach((p, i) => {
      if (i === photos.length - 1) {
        photosQuery += `('${p}', ${house.house_id}) `
      } else {
        photosQuery += `('${p}', ${house.house_id}), `
      }
    })
    photosQuery += 'RETURNING *'
    let photosCreated = await db.query(photosQuery)
    // Compose response
    house.photo = photosCreated.rows[0].photo
    house.reviews = 0
    house.rating = 0
    // Respond
    res.json(house)
  } catch (err) {
    res.json({ error: err.message })
  }
})

router.get('/houses', async (req, res) => {
  try {
    // build query base
    let sqlquery =
      'SELECT * FROM (SELECT DISTINCT ON (houses.house_id) houses.*, pictures.pic_url FROM houses'
    let filters = []
    // add photos
    sqlquery += ` LEFT JOIN pictures ON houses.house_id = pictures.house_id `
    // add WHERE
    if (
      req.query.location ||
      req.query.max_price ||
      req.query.min_rooms ||
      req.query.search
    ) {
      sqlquery += ' WHERE '
    }
    // add filters
    if (req.query.location) {
      filters.push(`location = '${req.query.location}'`)
    }
    if (req.query.max_price) {
      filters.push(`price_per_night <= '${req.query.max_price}'`)
    }
    if (req.query.min_rooms) {
      filters.push(`bedrooms >= '${req.query.min_rooms}'`)
    }
    if (req.query.search) {
      filters.push(`description LIKE '%${req.query.search}%'`)
    }
    // array to string divided by AND
    sqlquery += filters.join(' AND ')
    sqlquery += ') AS distinct_houses'
    // add ORDER BY
    if (req.query.sort === 'rooms') {
      sqlquery += ` ORDER BY bedrooms DESC`
    } else {
      sqlquery += ` ORDER BY price_per_night ASC`
    }
    // Run query
    let { rows } = await db.query(sqlquery)
    // Respond
    res.json(rows)
  } catch (err) {
    res.json({ error: err.message })
  }
})

router.get('/houses/:house_id', async (req, res) => {
  try {
    let { rows } = await db.query(
      `SELECT * FROM houses WHERE house_id = ${req.params.house_id}`
    )
    if (!rows.length) {
      throw new Error(`No house found with id ${req.params.user_id}`)
    }
    let house = rows[0]
    // join user
    let { rows: hostRows } = await db.query(
      `SELECT user_id, profile_pic_url, first_name, last_name FROM users WHERE user_id = ${house.host_id}`
    )
    house.host = {
      user_id: hostRows[0].user_id,
      profile_pic_url: hostRows[0].profile_pic_url,
      firstName: hostRows[0].first_name,
      lastName: hostRows[0].last_name
    }
    // join photos
    let { rows: photosRows } = await db.query(
      `SELECT * FROM pictures WHERE house_id = ${house.house_id}`
    )
    house.images = photosRows.map((p) => p.pic_url)
    delete house.user_id
    res.json(house)
  } catch (err) {
    res.json({ error: err.message })
  }
})

router.patch('/houses/:house_id', async (req, res) => {
  try {
    // Validate Token
    const decodedToken = jwt.verify(req.cookies.jwt, jwtSecret)
    if (!decodedToken || !decodedToken.user_id || !decodedToken.email) {
      throw new Error('Invalid authentication token')
    }
    const {
      location,
      bedrooms,
      bathrooms,
      description,
      price_per_night,
      pictures
    } = req.body

    let house
    //update houses table
    // Validate fields
    if (location || bedrooms || bathrooms || description || price_per_night) {
      let queryArray = []
      if (location) {
        queryArray.push(`location = '${location}'`)
      }
      if (bedrooms) {
        queryArray.push(`bedrooms = ${bedrooms}`)
      }
      if (bathrooms) {
        queryArray.push(`bathrooms = ${bathrooms}`)
      }
      if (description) {
        queryArray.push(`description = '${description}'`)
      }
      if (price_per_night) {
        queryArray.push(`price_per_night = ${price_per_night}`)
      }
      let query = `UPDATE houses SET ${queryArray.join()} WHERE house_id = ${req.params.house_id} AND host_id = ${decodedToken.user_id} RETURNING *`
      console.log('query for house', query)
      const { rows } = await db.query(query)
      house = rows[0]
      console.log('house response from houses', house)
    }
    //update pictures table
    console.log('req body pics', req.body.pictures)

    if (pictures && pictures.length) {
      // Fetch existing pictures for the house
      let { rows: pictureRows } = await db.query(
        `SELECT * FROM pictures WHERE house_id = ${req.params.house_id}`
      )
      console.log('select from pictures', pictureRows)

      // Update picture URLs based on request body
      pictureRows = pictureRows.map((p, i) => {
        if (pictures[i]) {
          p.pic_url = req.body.pictures[i]
        }
        return p
      })

      // Construct UPDATE query
      let picturesQuery = 'UPDATE pictures SET pic_url = (case '
      pictureRows.forEach((p, i) => {
        picturesQuery += `when picture_id = ${p.picture_id} then '${p.pic_url}' `
      })
      picturesQuery += 'end) WHERE picture_id in ('
      pictureRows.forEach((p, i) => {
        picturesQuery += `${p.picture_id}, `
      })
      picturesQuery = picturesQuery.slice(0, -2)
      picturesQuery += ') RETURNING *'
      console.log('pictures query', picturesQuery)
      // Update pictures and store updated URLs in house.images
      const { rows: updatedPictures } = await db.query(picturesQuery)
      house.images = updatedPictures.map((p) => p.pic_url)
    }

    // Send the response
    res.json(house)
  } catch (err) {
    console.error(err.message)
    res.json({ error: 'Please insert valid data' })
  }
})

router.get('/locations', async (req, res) => {
  try {
    let query = `SELECT DISTINCT(location) FROM houses`
    let { rows } = await db.query(query)
    rows = rows.map((r) => r.location)
    res.json(rows)
  } catch (err) {
    res.json({ error: err.message })
  }
})

router.get('/listings', async (req, res) => {
  try {
    // Validate Token
    const decodedToken = jwt.verify(req.cookies.jwt, jwtSecret)
    if (!decodedToken || !decodedToken.user_id || !decodedToken.email) {
      throw new Error('Invalid authentication token')
    }
    // Get houses
    let query = `
      SELECT
        houses.house_id,
        houses.location,
        houses.bedrooms,
        houses.bathrooms,
        houses.reviews_count,
        houses.rating,
        houses.price_per_night AS price,
        pictures.pic_url
      FROM houses
      LEFT JOIN (
          SELECT DISTINCT ON (house_id) house_id, pic_url
          FROM pictures
      ) AS pictures ON pictures.house_id = houses.house_id
      WHERE houses.host_id = ${decodedToken.user_id}
    `

    let { rows } = await db.query(query)
    // Respond
    res.json(rows)
  } catch (err) {
    res.json({ error: err.message })
  }
})

router.delete('/houses/:houseId', async (req, res) => {
  try {
    // Validate Token
    const decodedToken = jwt.verify(req.cookies.jwt, jwtSecret)
    if (!decodedToken || !decodedToken.user_id || !decodedToken.email) {
      throw new Error('Invalid authentication token')
    }
    // check if the user user_id (decodedToken.user_id) is the host of the house specified by house_id.
    const queryString = `
      SELECT * FROM houses WHERE host_id = ${decodedToken.user_id} AND house_id = ${req.params.houseId}
    `

    const result = await db.query(queryString)
    if (result.rowCount === 0) {
      throw new Error('not authorized')
    }

    const { rowCount } = await db.query(`
    DELETE FROM houses WHERE house_id = ${req.params.houseId}
    `)
    if (!rowCount) {
      throw new Error('Delete Failed')
    }
    //response message
    res.json({ message: `House ${req.params.houseId} is deleted` })
  } catch (err) {
    console.error(err)
    res.json({ error: 'Please insert a valid data' })
  }
})

export default router
