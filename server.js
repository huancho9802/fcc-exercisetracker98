const express = require("express");
const app = express();
const bodyParser = require("body-parser");

const cors = require("cors");

const db = require("mongodb");

const mongoose = require("mongoose");
mongoose.connect(process.env.MLAB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

app.use(cors());

//first middlewares
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});

var shortid = require("shortid");

let exerciseSchema = new mongoose.Schema({
  date: {type: Date},
  username: { type: String, required: true },
  duration: { type: Number, required: true },
  description: { type: String, required: true }
}, {versionKey: false});

let Exercise = mongoose.model("Exercise", exerciseSchema);

let userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  _id: {type: String}
}, {versionKey: false});

let User = mongoose.model("User", userSchema);

//User.deleteMany({}, (err, data) => {});
//Exercise.deleteMany({}, (err, data) => {});

// POST new-user
app.post("/api/exercise/new-user", function(req, res) {
  let username = req.body.username;
  User.findOne({ username: username }, (err, result) => {
    if (err) {
      return console.error(err);
    }
    if (result) {
      res.send("username taken");
    } else {
      User.create(
        { username: username, _id: shortid.generate() },
        (err, entry) => {
          if (err) {
            return console.log(err);
          } else {
            res.json(entry);
          }
        }
      );
    }
  });
});

// GET users
app.get("/api/exercise/users", (req, res) => {
  User.find({}, (err, result) => {
    if (err) {
      console.error(err);
    } else {
      res.json(result);
    }
  });
});

// POST exercises
app.post("/api/exercise/add", (req, res) =>{
  // define exerciseToAdd
  let exerciseToAdd = {};
  if (req.body.date) {
    exerciseToAdd = {
      date: new Date(req.body.date),
      duration: parseInt(req.body.duration),
      description: req.body.description
    };
  } else {
    exerciseToAdd = {
      date: new Date(),
      duration: parseInt(req.body.duration),
      description: req.body.description
    };
  }
  // create handlers
  User.findById(req.body.userId, (err, result) => {
    if (err) {
      return console.error(err);
    }
    if (!result) {
      res.send('id not found')
    } else {
      exerciseToAdd.username = result.username; 
      Exercise.create(exerciseToAdd, (err, entry) => {
        if (err) {
          return console.error(err)
        } else {
          res.json({
            "date": entry.date.toDateString(),
            "username": entry.username,
            "_id": result._id,
            "description": entry.description,
            "duration": entry.duration
          });
        }
      });
    }
  });
});

// GET log
app.get("/api/exercise/log", (req, res) => {
  // define search range
  let min = 0,
      max = new Date(),
      queryLimit = 500;
  if (req.query.from) {
    min = new Date(req.query.from);
  }
  if (req.query.to) {
    max = new Date(req.query.to);
  }
  if (req.query.limit) {
    queryLimit = parseInt(req.query.limit);
  }

  // Create handler
  User.findById(req.query.userId, (err, result) => {
    if (err) return console.error(err);
    if (!result) {
      res.send('id not found');
    } else {
      // find by criteria
      Exercise.find({username: result.username, date: {"$gte": min, "$lte": max}}).limit(queryLimit).exec((err, queries) => {
        if (err) {
          return console.error(err);
        } else {
          res.json({
            username: result.username,
            _id: result._id,
            count: queries.length,
            log: queries.map(elem => ({description: elem.description, duration: elem.duration, date: elem.date.toDateString()}))
          });
        }
      });
    }
  });
});

// Not found middleware
app.use((req, res, next) => {
  return next({ status: 404, message: "not found" });
});

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage;

  if (err.errors) {
    // mongoose validation error
    errCode = 400; // bad request
    const keys = Object.keys(err.errors);
    // report the first validation error
    errMessage = err.errors[keys[0]].message;
  } else {
    // generic or custom error
    errCode = err.status || 500;
    errMessage = err.message || "Internal Server Error";
  }
  res
    .status(errCode)
    .type("txt")
    .send(errMessage);
});
