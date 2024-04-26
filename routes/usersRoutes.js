import { Router } from 'express'
const router = Router()
import db from '../db.js' // import the database connection

// Define a GET route for fetching the list of users
router.get('/users', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM users') // query the database
    console.log(rows)
    res.json(rows) // respond with the data
  } catch (err) {
    console.error(err.message)
    res.json(err)
  }
})

router.get('/users/:userId', async (req, res) => {
  try {
    let userId = Number(req.params.userId)
    if (!userId) {
      throw new Error('Please insert a number')
    }
    const { rows } = await db.query(
      `SELECT * FROM users WHERE user_id = ${req.params.userId}`
    )
    if (rows.length === 0) {
      throw new Error('User not found')
    }
    res.json(rows)
  } catch (err) {
    console.error(err.message)
    res.json(err.message)
  }
})

//patch for update users
router.patch('/users/:userId', async (req, res) => {
  try {
    let queryArray = []
    if (req.body.first_name) {
      queryArray.push(`first_name = '${req.body.first_name}'`)
    }
    if (req.body.last_name) {
      queryArray.push(`last_name = '${req.body.last_name}'`)
    }
    if (req.body.email) {
      queryArray.push(`email = '${req.body.email}'`)
    }
    if (req.body.password) {
      queryArray.push(`password = '${req.body.password}'`)
    }
    let result = `UPDATE users SET ${queryArray.join()} WHERE user_id = ${req.params.userId} RETURNING *`
    const { rows } = await db.query(result)
    res.json(rows)
  } catch (err) {
    console.error(err.message)
    res.json({ error: 'Please insert a valid data' })
  }
})

export default router
