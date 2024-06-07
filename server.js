const express = require("express");
const app = express();
require("dotenv").config();
const { Pool } = require("pg");
const pool = require("./db");



const PORT = 4001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


//api

// app.get("/park/get-lot-info",async(req,res) => {
//   let {token,lotId} = req.query;

//     if (!token || !lotId) {
//     return res.status(400).json({ message: "Invalid request, missing field." });
//   }

//   //check salt key
//   if (
//     !(token == "fg3rk94v90tbmbme0856mbjk" )
//   ) {
//     return res
//       .status(401)
//       .json({ message: "Incorrect or missing  token : UnAuthorized Acess" });
//   }


//   const tableName = "lot";
//   const schemaName = "Parkingsystem";


//     const queryResult = await pool.query(
//       `
//      SELECT 
//      geom,cost_hr,occupied,peak_hr_rt,happy_hrs,
//      timing,available,cleaning,suspension,level,l_uid
//      FROM "Parkingsystem"."Lot"
//     WHERE
    
//      u_id = $1
//     LIMIT 1;
//       `,
//       [lotId]
//     );


//     console.log(queryResult.rows);
//  if (queryResult.rows.length === 0) {
//       return res.status(400).json({ message: `Data not found ` });
//     }

//     return queryResult.rows;



// })

app.get("/park/get-lot-info", async (req, res) => {
  let { token, lotId } = req.query;

  // Check if the required parameters are provided
  if (!token || !lotId) {
    return res.status(400).json({ message: "Invalid request, missing field." });
  }

  // Check the token
  if (token !== "fg3rk94v90tbmbme0856mbjk") {
    return res
      .status(401)
      .json({ message: "Incorrect or missing token: Unauthorized Access" });
  }

  try {
    // Query the database for lot information
    const queryResult = await pool.query(
      `
      SELECT 
        ST_AsText(geom) AS geom_text,
        cost_hr,
        occupied,
        peak_hr_rt,
        happy_hrs,
        timing,
        available,
        cleaning,
        suspension,
        level,u_id,
        l_uid
      FROM "Parkingsystem"."Lot"
      WHERE
        l_uid = $1
      LIMIT 1;
      `,
      [lotId]
    );

    // Check if the query returned any results
    if (queryResult.rows.length === 0) {
      return res.status(404).json({ message: "Lot not found." });
    }

    // Return the lot information as a JSON response
    res.status(200).json(queryResult.rows[0]);
  } catch (error) {
    console.error("Error executing query", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

app.get("/park/get-plot-info", async (req, res) => {
  let { token, plotId } = req.query;

  // Check if the required parameters are provided
  if (!token || !plotId) {
    return res.status(400).json({ message: "Invalid request, missing field." });
  }

  // Check the token
  if (token !== "fg3rk94v90tbmbme0856mbjk") {
    return res
      .status(401)
      .json({ message: "Incorrect or missing token: Unauthorized Access" });
  }

  try {
  const queryResult = await pool.query(
    `
  SELECT 
    ST_AsText(geom) AS geom_text,
    st,
    dt,
    ct,
    capacity,
    available,
    timing, 
    cleaning,  
    suspension,
    level
  FROM "Parkingsystem"."Plot"
  WHERE
    u_id = $1
  LIMIT 1;
  `,
    [plotId]
  );


    // Check if the query returned any results
    if (queryResult.rows.length === 0) {
      return res.status(404).json({ message: "Lot not found." });
    }

    // Return the lot information as a JSON response
    res.status(200).json(queryResult.rows[0]);
  } catch (error) {
    console.error("Error executing query", error);
    res.status(500).json({ message: "Internal server error." });
  }
});