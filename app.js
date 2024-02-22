const express = require('express')
const app = express()
app.use(express.json())
const path = require('path')
const sqlite3 = require('sqlite3')
const {open} = require('sqlite')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
let db = null

const connection = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3005, () => {
      console.log('Server Running at http://localhost:3005')
    })
  } catch (e) {
    console.log(`DB Error : ${e.message}`)
    process.exit(1)
  }
}

connection()

const stateJson = dbObject => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  }
}

const distJson = dbObject => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  }
}

const casesResponse = dbObject => {
  return {
    totalCases: dbObject.c,
    totalCured: dbObject.ca,
    totalActive: dbObject.a,
    totalDeaths: dbObject.d,
  }
}

const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }

  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

// API : 1
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const userQuery = `SELECT * FROM user WHERE username = "${username}";`
  const userData = await db.get(userQuery)

  if (userData !== undefined) {
    const isPasswordMatched = await bcrypt.compare(password, userData.password)

    if (isPasswordMatched === true) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'MY_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  } else {
    response.status(400)
    response.send('Invalid user')
  }
})

// API : 2

app.get('/states/', authenticateToken, async (request, response) => {
  const selectQuery = `SELECT * FROM state;`
  const resultArray = await db.all(selectQuery)
  response.send(resultArray.map(each => stateJson(each)))
})

// API : 3

app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const query = `SELECT * FROM state WHERE state_id = ${stateId};`
  const result = await db.get(query)
  response.send(stateJson(result))
})

// API : 4

app.post('/districts/', authenticateToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const query = `INSERT INTO 
                district(district_name,state_id,cases,cured,active,deaths)
                VALUES("${districtName}",${stateId},${cases},${cured},${active},${deaths});`
  await db.run(query)
  response.send('District Successfully Added')
})

// API : 5

app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const query = `SELECT * FROM district WHERE district_id = ${districtId};`
    const result = await db.get(query)
    response.send(distJson(result))
  },
)

// API : 6

app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const query = `DELETE FROM district WHERE district_id = ${districtId};`
    await db.run(query)
    response.send('District Removed')
  },
)

//API : 7

app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const query = `
      UPDATE district
      SET 
      district_name = "${districtName}",
      state_id = ${stateId},
      cases = ${cases},
      cured = ${cured},
      active = ${active},
      deaths =${deaths}
      WHERE district_id = ${districtId};`
    await db.run(query)
    response.send('District Details Updated')
  },
)

// API : 8

app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const query = `SELECT 
        SUM(cases) AS c,
        SUM(cured) AS ca,
        SUM(active) AS a , 
        SUM(deaths) AS d
      FROM district WHERE state_id = ${stateId};`
    const result = await db.get(query)
    response.send(casesResponse(result))
  },
)

module.exports = app;
