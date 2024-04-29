import { Router } from 'express'
import db from '../db.js'
import jwt from 'jsonwebtoken'
const jwtSecret = process.env.JWT_SECRET
const router = Router()

//POST route insert a row in the reviews table
router.post('/reviews', async (req, res) => {
  try {
    // Validate Token
    const decodedToken = jwt.verify(req.cookies.jwt, jwtSecret)
    if (!decodedToken || !decodedToken.user_id || !decodedToken.email) {
      throw new Error('Invalid authentication token')
    }

    // Validate fields
    let { house_id, review_text, star_rating } = req.body
    if (!house_id || !review_text || !star_rating) {
      throw new Error('house_id, review_text, and star_rating are required')
    }

    // Validate rating
    if (star_rating < 0 || star_rating > 5) {
      throw new Error('rating must be between 0 and 5')
    }

    // Get current date in 'YYYY-MM-DD' format
    let currentDate = new Date().toISOString().split('T')[0]

    // Insert review
    let { rows } = await db.query(`
  INSERT INTO reviews (house_id, reviewer_id, review_date, review_text, star_rating)
  VALUES (${house_id}, ${decodedToken.user_id}, '${currentDate}', '${review_text}', ${star_rating})
  RETURNING *
`)

    // Add other fields
    let { rows: usersRows } = await db.query(`
      SELECT users.first_name, users.last_name, users.profile_pic_url FROM users
      WHERE user_id = ${decodedToken.user_id}
    `)
    let review = rows[0]
    review.author = usersRows[0]
    const formatter = new Intl.DateTimeFormat('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
    const formatted = formatter.format(new Date(review.date))
    review.date = formatted
    res.json(review)

    // Update house
    let houseUpdated = await db.query(
      `UPDATE houses SET reviews_count = reviews_count + 1, rating = ROUND((rating + ${rating}) / (reviews_count + 1)) WHERE house_id = ${house_id} RETURNING *`
    )
  } catch (err) {
    res.json({ error: err.message })
  }
})

router.get('/reviews', async (req, res) => {
  try {
    if (!req.query.house_id) {
      throw new Error('house_id is required')
    }

    let sqlquery = `
      SELECT reviews.*, users.first_name, users.last_name, users.profile_pic_url FROM reviews
      LEFT JOIN users ON users.user_id = reviews.reviewer_id
      WHERE house_id = ${req.query.house_id}
      ORDER BY review_date DESC
    `

    let { rows } = await db.query(sqlquery)
    const formatter = new Intl.DateTimeFormat('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })

    let reviews = rows.map((r) => {
      r.author = {
        firstName: r.first_name,
        lastName: r.last_name,
        profile_pic_url: r.profile_pic_url
      }
      r.review_date = formatter.format(new Date(r.review_date))
      delete r.first_name
      delete r.last_name
      delete r.profile_pic_url
      return r
    })
    res.json(reviews)
  } catch (err) {
    res.json({ error: err.message })
  }
})

//For testing purpose
// GET route for fetching a single review
// router.get('/reviews/:reviewId', async (req, res) => {
//   try {
//     let reviewId = Number(req.params.reviewId)
//     if (!reviewId) {
//       throw new Error('Please insert a number')
//     }
//     const { rows } = await db.query(
//       `SELECT * FROM reviews WHERE review_id = ${req.params.reviewId}`
//     )
//     if (rows.length === 0) {
//       throw new Error(`No review found with id ${req.params.reviewId}`)
//     }
//     console.log(rows)
//     res.json(rows)
//   } catch (err) {
//     console.error(err.message)
//     res.json(err.message)
//   }
// })

// GET route for fetching all reviews
// router.get('/reviews', async (req, res) => {
//   try {
//     // query to sort reviews to show newest first
//     let queryReview = 'SELECT * FROM reviews ORDER BY review_date DESC'

//     //  query to return reviews that belong a specific house
//     if (req.query.house) {
//       queryReview = `SELECT * FROM reviews WHERE house_id = '${req.query.house}'
//       ORDER BY review_date DESC`
//     }

//     const { rows } = await db.query(queryReview)
//     console.log(rows)
//     res.json(rows)
//   } catch (err) {
//     console.error(err.message)
//     res.json(err)
//   }
// })

//DELETE reviews
// router.delete('/reviews/:reviewId', async (req, res) => {
//   try {
//     const { rowCount } = await db.query(`
//     DELETE FROM reviews WHERE review_id = ${req.params.reviewId}
//     `)
//     if (!rowCount) {
//       throw new Error('Delete Failed')
//     }
//     res.json(rowCount)
//   } catch (err) {
//     console.error(err)
//     res.json({ error: 'Please insert a valid data' })
//   }
// })

export default router
