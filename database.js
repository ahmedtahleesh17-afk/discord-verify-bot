const mysql = require("mysql2");
const config = require("./config");

const db = mysql.createConnection(config.db);

db.connect(err => {
  if (err) {
    console.error("❌ Database Error:", err);
  } else {
    console.log("✅ MySQL Connected");
  }
});

module.exports = db;


