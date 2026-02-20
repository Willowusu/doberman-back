require('dotenv').config();
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const cors = require('cors');
const session = require('express-session');

const connectDB  = require('./services/database');

var apiV1Router = require('./routes/apiV1');

var app = express();

app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] // Added OPTIONS for preflight
}));

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || "dev-secret",
  resave: false,
  saveUninitialized: false,
  proxy: true, // Required for secure cookies over a proxy
  cookie: {
    httpOnly: true,
    // On Render, this MUST be true. If it's false, browser won't store it.
    secure: true,
    // This MUST be 'none' for cross-site (front.render -> back.render)
    // If it's 'lax', the cookie won't be sent on the /generate-mfa request.
    sameSite: 'none',
    maxAge: 1000 * 60 * 60 * 24
  }
}));


app.use('/api/v1', apiV1Router);

// Connect to Database
connectDB();

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.json({
    error: err.message || 'Bad request'
  });
});

module.exports = app;
