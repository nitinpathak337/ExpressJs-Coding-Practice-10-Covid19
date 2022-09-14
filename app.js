const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

//Initializing server and making connection to database

const initializeDB = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running");
    });
  } catch (e) {
    console.log(`DB Error:'${e.message}'`);
    process.exit(1);
  }
};

initializeDB();

//Login API

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
    select * 
    from user
    where username='${username}';`;
  const selectUser = await db.get(selectUserQuery);
  if (selectUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const compPass = await bcrypt.compare(password, selectUser.password);
    if (compPass === true) {
      const payload = { username: username };
      let jwtToken;
      jwtToken = await jwt.sign(payload, "abcd");

      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//Authenticate Token Middleware function

const authenticateToken = async (request, response, next) => {
  const authObj = request.headers.authorization;

  if (authObj === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    let jwtToken;
    jwtToken = authObj.split(" ")[1];
    jwt.verify(jwtToken, "abcd", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

const convertCase = (obj) => {
  return {
    stateId: obj.state_id,
    stateName: obj.state_name,
    population: obj.population,
  };
};

//Get list of states API

app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
    select * 
    from state;`;
  const getStates = await db.all(getStatesQuery);
  const newList = [];
  for (let i of getStates) {
    let item = convertCase(i);
    newList.push(item);
  }
  response.send(newList);
});

//Get state API

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
    select * from 
    state where
    state_id=${stateId};`;
  const getState = await db.get(getStateQuery);
  const newState = convertCase(getState);
  response.send(newState);
});

//Create district API

app.post("/districts/", authenticateToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const createDistrictQuery = `
    Insert into
    district(district_name,state_id,
        cases,cured,active,deaths)
        values('${districtName}',${stateId},${cases},
        ${cured},${active},${deaths});`;
  const createDistrict = await db.run(createDistrictQuery);
  response.send("District Successfully Added");
});

//Get district API

const convertCaseDistrict = (obj) => {
  return {
    districtId: obj.district_id,
    districtName: obj.district_name,
    stateId: obj.state_id,
    cases: obj.cases,
    cured: obj.cured,
    active: obj.active,
    deaths: obj.deaths,
  };
};

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
    select * from
    district where
    district_id=${districtId};`;
    const getDistrict = await db.get(getDistrictQuery);
    const newDistrict = convertCaseDistrict(getDistrict);
    response.send(newDistrict);
  }
);

//Delete district API

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
    delete from
    district where
    district_id=${districtId};`;
    const deleteDistrict = await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//Update district API
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const updateDistrictQuery = `
    update district
    set district_name='${districtName}',
    state_id=${stateId},
    cases=${cases},
    cured=${cured},
    active=${active},
    deaths=${deaths}
    where
    district_id=${districtId};`;
    const updateDistrict = await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//stats of state API

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const statsQuery = `select sum(cases) as totalCases,
    sum(cured) as totalCured,
    sum(active) as totalActive,
    sum(deaths) as totalDeaths
    from district
    where state_id=${stateId};`;
    const stats = await db.get(statsQuery);
    response.send(stats);
  }
);

//state name API

app.get(
  "/districts/:districtId/details/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getStateNameQuery = `
    select state_name as stateName
    from state 
    where state_id=(
        select state_id from
        district where 
        district_id=${districtId}
    );`;
    const getStateName = await db.get(getStateNameQuery);
    response.send(getStateName);
  }
);

module.exports = app;
