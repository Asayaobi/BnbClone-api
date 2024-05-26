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
    const { house_id, review_text, star_rating } = req.body
    if (!house_id || !review_text || !star_rating) {
      throw new Error('house_id, review_text, and star_rating are required')
    }

    // Validate rating
    if (star_rating < 0 || star_rating > 5) {
      throw new Error('rating must be between 0 and 5')
    }

    // Get current date in 'YYYY-MM-DD' format
    const currentDate = new Date().toISOString().split('T')[0]

    // Insert review
    const { rows } = await db.query(`
      INSERT INTO reviews (house_id, reviewer_id, review_date, review_text, star_rating)
      VALUES (${house_id}, ${decodedToken.user_id}, '${currentDate}', '${review_text}', ${star_rating})
      RETURNING *
    `)

    // Add other fields
    const { rows: usersRows } = await db.query(`
      SELECT users.first_name, users.last_name, users.profile_pic_url FROM users
      WHERE user_id = ${decodedToken.user_id}
    `)
    const review = rows[0]
    review.author = usersRows[0]

    //Update the average rating
    const updateQuery = `WITH review_stats AS (
    SELECT 
        house_id, 
        COUNT(review_id) AS reviews_count, 
        AVG(star_rating) AS avg_rating
    FROM 
        reviews
    GROUP BY 
        house_id
)
UPDATE 
    houses
SET 
    reviews_count = rs.reviews_count,
    rating = rs.avg_rating
FROM 
    review_stats rs
WHERE 
    houses.house_id = rs.house_id`
    await db.query(updateQuery)

    // Send response
    res.json(review)
  } catch (error) {
    console.error('Error creating review:', error)
    res
      .status(500)
      .json({ error: 'An error occurred while processing your request' })
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

export default router
