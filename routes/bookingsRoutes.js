import { Router } from 'express'
import db from '../db.js'
import jwt from 'jsonwebtoken'
import { jwtSecret } from '../secrets.js'
const router = Router()

router.post('/bookings', async (req, res) => {
  try {
    // Validate Token
    const decodedToken = jwt.verify(req.cookies.jwt, jwtSecret)
    if (!decodedToken || !decodedToken.user_id || !decodedToken.email) {
      throw new Error('Invalid authentication token')
    }
    // Validate fields
    let { house_id, booking_start_date, booking_end_date, message_to_host } =
      req.body
    if (
      !house_id ||
      !booking_start_date ||
      !booking_end_date ||
      !message_to_host
    ) {
      throw new Error(
        'house_id, booking_start_date, booking_end_date, and message_to_host are required'
      )
    }
    // Find house to get price
    let houseFound = await db.query(
      `SELECT house_id, price_per_night FROM houses WHERE house_id = ${house_id}`
    )
    if (!houseFound.rows.length) {
      throw new Error(`House with id ${house_id} not found`)
    }
    const house = houseFound.rows[0]
    // Calculate total nights
    let checkingDate = new Date(req.body.booking_start_date)
    let checkoutDate = new Date(req.body.booking_end_date)
    if (checkoutDate <= checkingDate) {
      throw new Error('booking_end_date must be after booking_start_date')
    }
    const totalNights = Math.round(
      (checkoutDate - checkingDate) / (1000 * 60 * 60 * 24)
    )
    // Calculate total price
    const totalPrice = totalNights * house.price_per_night
    // Create booking
    let { rows } = await db.query(`
      INSERT INTO bookings (house_id, user_id, booking_start_date, booking_end_date, message_to_host, nights, price_per_night, price)
      VALUES ('${house_id}', '${decodedToken.user_id}', '${booking_start_date}', '${booking_end_date}', '${message_to_host}', ${totalNights}, ${house.price_per_night}, ${totalPrice})
      RETURNING *
    `)
 
    // Respond
    res.json(rows[0])
  } catch (err) {
    res.json({ error: err.message })
  }
})

// params for GET bookings/1

router.get('/bookings/:bookingId', async (req, res) => {
  try {
    let bookingId = Number(req.params.bookingId)
    if (!bookingId) {
      throw new Error('Please insert a number')
    }
    const { rows } = await db.query(
      `SELECT * FROM bookings WHERE booking_id = ${req.params.bookingId}`
    )
    if (rows.length === 0) {
      throw new Error(`No Booking found with ID ${req.params.bookingId}`)
    }
    res.json(rows)
  } catch (err) {
    console.error(err.message)
    res.json(err.message)
  }
})

//Update the /bookings route with queries

router.get('/bookings', async (req, res) => {
  try {
    let queryBookings =
      'SELECT * FROM bookings ORDER BY booking_start_date DESC'
    if (req.query.user) {
      queryBookings = `SELECT * FROM bookings WHERE user_id = ${req.query.user} ORDER BY booking_start_date DESC`
    }
    const { rows } = await db.query(queryBookings)
    res.json(rows)
  } catch (err) {
    console.error(err.message)
    res.json(err)
  }
})

// POST bookings

router.post('/bookings', async (req, res) => {
  try {
    const {
      user_id,
      booking_id,
      house_id,
      booking_start_date,
      booking_end_date,
      price,
      message_to_host
    } = req.body
    console.log(req.body, user_id, booking_id)
    const queryString = `
      INSERT INTO bookings (user_id, booking_id, house_id, booking_start_date, booking_end_date, price, message_to_host)
      VALUES (${user_id}, ${booking_id}, ${house_id}, '${booking_start_date}', '${booking_end_date}', ${price}, '${message_to_host}')
      RETURNING *
    `
    console.log(queryString)
    const { rows } = await db.query(queryString)
    res.json(rows)
  } catch (err) {
    console.error(err.message)
    res.json(err)
  }
})

// DELETE bookings
router.delete('/bookings/:bookingId', async (req, res) => {
  try {
    const { rowCount } = await db.query(`
    DELETE FROM bookings WHERE booking_id = ${req.params.bookingId}`)
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

// Similarly, update the /bookings route so that, by default and without any URL query, it responds with the list of bookings
// sorted by latest "start date"("from", or "from_date" depending on the database column name) in descending order.

// Update the /bookings route so that, if a user property is added to the request query, it should only return bookings that belong to (made by) that user, such as:

// /bookings?user=1
