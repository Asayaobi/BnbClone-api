import { Router } from 'express'
import db from '../db.js'
const router = Router()
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { secret } from '../secrets.js'

router.post('/signup', async (req, res) => {
  //1. Check if the new user is not registered
  //1.1 search in the data base for an user that is using the email that is trying to register
  try {
    const userAlreadyExist = await db.query(
      `SELECT * FROM users WHERE users.email = '${req.body.email}'`
    )
    // console.log(userAlreadyExist.rows[0])
    const userFound = userAlreadyExist.rows[0]
    //1.2 if the users already exist thorw an error message otherwise step 2
    if (userFound) {
      throw new Error('This user already exist')
    }

    //2. Hash the passworde before store it in the data base
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(req.body.password, salt)
    // console.log(hashedPassword)
    //3. create a new user using the data that the client provides
    const newUser = await db.query(
      `INSERT INTO users (first_name, last_name, email, password, profile_photo) 
      VALUES ('${req.body.first_name}','${req.body.last_name}', '${req.body.email}', '${hashedPassword}', '${req.body.profile_photo}') RETURNING *`
    )
    // console.log(newUser)
    const userCreated = newUser.rows[0]
    // console.log(userCreated)
    //4. create the token
    //4.1 extract the data to create the token
    const user = { user_id: userCreated.user_id }
    // console.log(user)
    //4.2 add a secret word
    // console.log(secret)
    //4.3 create it
    const token = jwt.sign(user, secret)
    // console.log(token)
    //5. send it via cookies and a message that the user was register succesfully
    res.cookie('jwt', token)
    res.json({ message: 'user succesfully register' })
  } catch (error) {
    res.json({ error: error.message })
  }
})

router.post('/login', async (req, res) => {
  const email = req.body.email
  const password = req.body.password
  const queryString = `SELECT * FROM users WHERE users.email = '${email}' AND users.password = '${password}'`
  try {
    const { rows } = await db.query(queryString)
    res.json(rows)
  } catch (err) {
    res.json({ error: err.message })
  }
})

router.get('/logout', (req, res) => {
  res.clearCookie('jwt')
  res.send('You are logged out')
})

export default router