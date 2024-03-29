import { Router } from 'express'
import db from '../db.js' // import the database connection
import jwt from 'jsonwebtoken'
import { jwtSecret } from '../secrets.js'
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
    let photosQuery = 'INSERT INTO pictures (house_id, pic_url) VALUES '
    photos.forEach((p, i) => {
      if (i === photos.length - 1) {
        photosQuery += `(${house.house_id}, '${p}') `
      } else {
        photosQuery += `(${house.house_id}, '${p}'), `
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
      sqlquery += ` ORDER BY rooms DESC`
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

// Define a GET route for fetching a single house
router.get('/houses/:houseId', async (req, res) => {
  try {
    let houseId = Number(req.params.houseId)
    if (!houseId) {
      throw new Error('Please insert a number')
    }
    const { rows } = await db.query(
      `SELECT * FROM houses WHERE house_id = ${req.params.houseId}`
    )
    if (rows.length === 0) {
      throw new Error(`No house found with id ${req.params.houseId}`)
    }
    res.json(rows)
  } catch (err) {
    console.error(err.message)
    res.json(err.message)
  }
})

// Update the /houses route with query using queryString
// router.get('/houses', async (req, res) => {
//   try {
//     //query for houses with 1 = 1 to start with true condition
//     let queryString = 'SELECT * FROM houses WHERE 1 = 1'
//     //query for location
//     if (req.query.location) {
//       queryString += ` AND location = '${req.query.location}'`
//     }
//     //query for max price
//     if (req.query.max_price) {
//       queryString += ` AND price_per_night <= '${req.query.max_price}'`
//     }
//     //query for min rooms
//     if (req.query.min_rooms) {
//       queryString += ` AND bedrooms >= '${req.query.min_rooms}'`
//     }
//     //query for search
//     if (req.query.search) {
//       queryString += ` AND description LIKE '%${req.query.search}%'`
//     }
//     // query for sort and order
//     if (req.query.sort && req.query.order) {
//       queryString += ` ORDER BY ${req.query.sort} ${req.query.order}`
//     } else if (req.query.sort) {
//       // query for sort and make it ASC by default
//       queryString += ` ORDER BY ${req.query.sort} ASC`
//     }
//     const { rows } = await db.query(queryString)
//     res.json(rows)
//   } catch (err) {
//     console.error(err.message)
//     res.json(err)
//   }
// })

// PATCH for houses
router.patch('/houses/:house_id', async (req, res) => {
  try {
    const { location, bedrooms, bathrooms, description, price_per_night } =
      req.body
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
    let result = `UPDATE houses SET ${queryArray.join()} WHERE house_id = ${req.params.house_id} RETURNING *`
    console.log(result)
    const r = await db.query(result)
    res.json(r.rows)
  } catch (err) {
    console.error(err.message)
    res.json({ error: 'Please insert valid data' })
  }
})

// DELETE houses
router.delete('/houses/:houseId', async (req, res) => {
  try {
    const { rowCount } = await db.query(`
    DELETE FROM houses WHERE house_id = ${req.params.houseId}`)
    if (!rowCount) {
      throw new Error('Delete Failed')
    }
    res.json(rowCount)
  } catch (err) {
    console.error(err)
    res.json({ error: 'Please insert a valid data' })
  }
})

export default router
