const express = require("express");
const app = express();
const { Pool } = require("pg");
const proj4 = require("proj4");

const destCRS = "EPSG:4326";
proj4.defs(destCRS, "+proj=longlat +datum=WGS84 +no_defs");

// Define the EPSG:32643 projection (UTM zone 43N)
const sourceCRS = "EPSG:32643";
proj4.defs(sourceCRS, "+proj=utm +zone=43 +datum=WGS84 +units=m +no_defs");

const dbConfig = {
  user: "postgres",
  host: "geoserver.quantasip.com",
  database: "qg_verse",
  password: "Qgis@1234",
  port: 5432, // Default PostgreSQL port
};

const pool = new Pool(dbConfig);

//
let client = {
  a7b9c6d8e5f1a3b2c4d7e8f9a0b1c2d3: {
    "getData-by-uid": 0,
    "adjData-by-uid": 0,
  },
};

pool.connect((err, client, release) => {
  if (err) {
    console.error("Error connecting to the database:", err);
  } else {
    console.log("Connected to the database.");
    client.query("SELECT NOW()", (err, result) => {
      release();
      if (err) {
        console.error("Error running query:", err);
      } else {
        console.log("Current timestamp:", result.rows[0].now);
      }
    });
  }
});

app.get("/api/database-status", async (req, res) => {
  const { saltKey } = req.query;
  try {
    // Get a client from the pool
    if (
      saltKey == "c4f1e08a2b5d1e3f8d9a0b6c3e2d5a1" ||
      saltKey == "iamrutwik"
    ) {
      const client = await pool.connect();
      // Release the client back to the pool
      client.release();
      res.status(200).json({ status: "Connected to database" });
    } else {
      return res
        .status(401)
        .json({ message: "Incorrect or missing salt key: UnAuthorized Acess" });
    }
  } catch (error) {
    console.error("Error connecting to the database:", error);
    res.status(500).json({ status: "Database connection error" });
  }
});

app.get("/test-api/adjData-by-uid", async (req, res) => {
  let { u_id, saltKey } = req.query;

  if (!u_id || !saltKey) {
    return res.status(400).json({ message: "Invalid request, missing field." });
  }

  //check salt key
  if (!(saltKey == "a7b9c6d8e5f1a3b2c4d7e8f9a0b1c2d3")) {
    return res
      .status(401)
      .json({ message: "Incorrect or missing salt key: UnAuthorized Acess" });
  }

  //Check State ,district ,tehsil and lgd_code in master_data

  const stateCodeToName = {
    "08": "rajasthan",
    8: "rajasthan",
    "09": "uttar pradesh",
    9: "uttar pradesh",
  };
  const str = u_id;
  let stateCode;
  if (str[1] == "_") {
    stateCode = str.substring(0, 1);
  } else {
    stateCode = str.substring(0, 2);
  }

  const state = stateCodeToName[stateCode];

  const { tehsilExists } = await getTehsil(u_id, state);
  const tehsil = tehsilExists.toLowerCase();
  

  if (!tehsil) {
    return res.status(400).json({ message: "Data not found" });
  }

  try {
    // console.time("id");

    // console.log("id checking");
    let tableName = `"${tehsil}"`;
    let tableShema = `"${state}"`;
    //tableName = `"${tableName}"`;
    //tableShema = `"${tableShema}"`;
    console.log(tableShema, tableName);

    const queryResult = await pool.query(
      `
                SELECT
                guid,
                lgd_code
                FROM ${tableShema}.${tableName}
                WHERE
                
                 u_id = $1 
                LIMIT 1;
          `,
      [u_id]
    );
    //  console.timeEnd("id");

    console.log(queryResult.rows[0]);

    if (queryResult.rows.length == 0) {
      //console.log("id is not there in DB");
      // await sendEmail(saltKey, district, lgd_code, khasra_no);
      return res.status(400).json({ message: "Data not found", khasra_no });
    }

    //  console.log(queryResult.rows[0].id);
    const guid = queryResult.rows[0].guid;
    const lgd_code = queryResult.rows[0].lgd_code;

    // Now use id in the second query
    //  console.time("cent");
    const customQueryResult = await pool.query(
      `
            SELECT 
            a.khasra_no, 
            CASE 
                WHEN ST_SRID(a.geom) = 32643 THEN 
                    ST_AsText(ST_Transform(ST_Centroid(a.geom), 4326)) 
                ELSE 
                    ST_AsText(ST_Centroid(a.geom)) 
            END AS st_astext
        FROM 
            ${tableShema}.${tableName} AS a
        JOIN 
            ${tableShema}.${tableName} AS b ON ST_Intersects(a.geom, b.geom)
        WHERE 
            b.guid = $1 AND a.guid != $1
            AND a.lgd_code = $2;
`,
      [guid, lgd_code]
    );

    // console.timeEnd("cent");

    if (customQueryResult.rows[0].length == 0) {
      //  await sendEmail(saltKey, district, lgd_code, khasra_no);
      return res.status(404).json({ message: "No neighbouring polygons" });
    }

    // apiCounter(saltKey);
    // updateLogEntry(saltKey,lgd_code,khasra_no)   // counter
    // Process the result as needed
    try {
      if (apiCounter(saltKey, "adjData-by-uid")) {
        updateLog(saltKey, u_id, "adjData-by-uid");

        return res.json(customQueryResult.rows);
      } else {
        return res
          .status(400)
          .json({ message: "Access denied! Limit reached." });
      }
    } catch (error) {
      console.log(error);
      return res.status(400).json({ message: "API access limit exceeded" });
    }
  } catch (error) {
    console.error("Error executing queries", error);

    // await sendEmail(saltKey, district,village, lgd_code, khasra_no);
    return res.status(500).send("Internal Server Error");
  }
});

app.get("/test-api/getData-by-uid", async (req, res) => {
  let { u_id, saltKey } = req.query;

  if (!u_id || !saltKey) {
    return res.status(400).json({ message: "Invalid request, missing field." });
  }

  // Check salt key
  if (!(saltKey === "a7b9c6d8e5f1a3b2c4d7e8f9a0b1c2d3")) {
    return res
      .status(401)
      .json({ message: "Incorrect or missing salt key: Unauthorized Access" });
  }

  const stateCodeToName = {
    "08": "rajasthan",
    8: "rajasthan",
    "09": "uttar pradesh",
    9: "uttar pradesh",
  };
  const str = u_id;
  let stateCode;
  if (str[1] == "_") {
    stateCode = str.substring(0, 1);
  } else {
    stateCode = str.substring(0, 2);
  }

  const state = stateCodeToName[stateCode];

  const { tehsilExists } = await getTehsil(u_id, state);
  const tehsil = tehsilExists.toLowerCase();
  console.log(tehsil);

  if (!tehsil) {
    return res.status(400).json({ message: "Data not found" });
  }

  try {
    let tableName = tehsil;
    let tableShema = state;
    tableName = `"${tableName}"`;
    tableShema = `"${tableShema}"`;

    const queryResult = await pool.query(
      `
      SELECT
      ST_AsGeoJSON(geom) AS geometry,
      district,
      village,
      lgd_code,
      khasra_no,
      area_ac
    FROM ${tableShema}.${tableName}
    WHERE
    
      u_id = $1 
    LIMIT 1;
      `,
      [u_id]
    );

    if (queryResult.rows.length === 0) {
      return res.status(400).json({ message: `Data not found ` });
    }

    // check geometry

    if (!queryResult.rows[0].geometry) {
      return res.status(404).json({ message: "Field Geometry not found" });
    }

    //check area_ac
    if (!queryResult.rows[0].area_ac) {
      return res.status(404).json({ message: "Field area_ac not found" });
    }

    if (!queryResult.rows[0].district) {
      return res.status(404).json({ message: "District not found" });
    }

    if (!queryResult.rows[0].village) {
      return res.status(404).json({ message: "Village not found" });
    }

    if (!queryResult.rows[0].lgd_code) {
      return res.status(404).json({ message: "lgd_code not found" });
    }

    if (!queryResult.rows[0].khasra_no) {
      return res.status(404).json({ message: "khsara_no not found" });
    }

    const district = queryResult.rows[0].district;
    const village = queryResult.rows[0].village;
    const lgd_code = queryResult.rows[0].lgd_code;
    const khasra_no = queryResult.rows[0].khasra_no;
    //const area_ac = queryResult.rows[0].area_ac;

    const features = queryResult.rows.map((row) => {
      x = JSON.parse(row.geometry);

      x.coordinates = x.coordinates[0][0];

      if (state == "rajasthan") {
        x.coordinates = x.coordinates.map((coord) =>
          proj4(sourceCRS, destCRS, coord)
        );
      }

      if (1) {
        x.crs = {
          type: "name",
          properties: {
            name: "EPSG:4326",
          },
        };
      }

      const orderedGeometry = {
        type: x.type,
        crs: x.crs,
        coordinates: x.coordinates,
      };

      return {
        type: "Feature",
        geometry: orderedGeometry,
        properties: {
          fid: row.fid,
          objectid: row.objectid,
          State: state,
          District: district,
          Tehsil: tehsil,
          Village: village,
          Khasra_No: row.khasra_no,
          Area_ac: row.area_ac,
          Shape_Leng: row.shape_leng,
          Shape_Area: row.shape_area,
          path: row.path,
          layer: row.layer,
          new_area_a: row.new_area_a,
        },
      };
    });

    const geoJsonResponse = {
      type: "FeatureCollection",
      features: features,
    };

    // Check API limit

    if (apiCounter(saltKey, "getData-by-uid")) {
      updateLog(saltKey, u_id, "getData-by-uid");

      res.status(200).json(geoJsonResponse);
    } else {
      res.status(400).json({ message: "Access denied! Limit reached." });
    }
  } catch (error) {
    console.error("Error executing query:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/admin/allClient", async (req, res) => {
  const { saltKey } = req.query;
  try {
    if (saltKey == "iamrutwik") {
      return res.status(200).json(client);
    }
  } catch (err) {
    console.log(err);
  }
});

function apiCounter(saltKey, key) {
  if (client[saltKey][key] <= 500) {
    client[saltKey][key]++;

    return true;
  } else {
    // (async () => {

    // })();

    // return res.status(402).json({ message: "Trial ended..." });
    return false;
  }
}

async function updateLog(saltKey, u_id, apiName) {
  try {
    let tableShema = "admin";

    const query = `
    INSERT INTO ${tableShema}.test_satsurelogs (saltkey, u_id,date,apiname)
    VALUES ($1, $2, CURRENT_TIMESTAMP,$3);

`;

    const values = [saltKey, u_id, apiName];

    const result = await pool.query(query, values);

    //console.log(`Rows affected: ${result.rowCount}`);
  } catch (error) {
    console.error("Error updating log entry:", error);
  }
}

async function getTehsil(u_id, state) {
  console.log(u_id, state);
  try {
    //console.time('checkup all');
    let tableName = state;
    tableName = `"${tableName}"`;

    const result = await pool.query(
      ` 
      SELECT tehsil FROM ${tableName}.master_data_uid WHERE u_id ILIKE $1 limit 1
     `,
      [u_id]
    );

    const { tehsil } = result.rows[0];

    return {
      tehsilExists: tehsil,
    };
  } catch (error) {
    console.error("Error checking states:", error);
    return {
      tehsilExists: false,
    };
  }
}

function convertToWGS84(centroid) {
  // Convert WKT to an array of coordinates
  const match = centroid.match(/POINT\(([^ ]+) ([^ ]+)\)/);
  if (!match) {
    throw new Error("Invalid WKT format");
  }
  const x = parseFloat(match[1]);
  const y = parseFloat(match[2]);

  // Convert the coordinates
  const [lon, lat] = proj4(sourceCRS, destCRS, [x, y]);

  return `POINT(${lon} ${lat})`;
}

const PORT = 4001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
