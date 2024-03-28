// import express
import express from 'express'
import cookieParser from 'cookie-parser'

import photosRouter from './routes/photosRoutes.js'
import authRouter from './routes/authRoutes.js'
import housesRouter from './routes/housesRoutes.js'
import usersRouter from './routes/usersRoutes.js'
import bookingsRouter from './routes/bookingsRoutes.js'
import reviewsRouter from './routes/reviewsRoutes.js'

const app = express()

// Middleware to parse JSON bodies
app.use(express.json())
app.use(cookieParser())

app.use(reviewsRouter)
app.use(bookingsRouter)
app.use(authRouter)
app.use(photosRouter)
app.use(housesRouter)
app.use(usersRouter)

app.listen(4100, () => {
  console.log('Airbnb API ready on localhost:4100')
})
