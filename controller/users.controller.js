const User = require("../models/user.model");
const passport = require("passport");
const { v4: uuidv4 } = require("uuid");
const nodemailer = require("nodemailer");

module.exports.registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const user = new User({ username, email });

    // Generate verification token using uuid
    const token = uuidv4();
    user.verificationToken = token;

    await User.register(user, password);

    // Send verification email
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: user.email,
      subject: "Email Verification",
      text: `Please verify your email by clicking on the following link: 
        http://${req.headers.host}/users/verify-email?token=${token}`,
    };

    await transporter.sendMail(mailOptions);

    req.flash(
      "success",
      "A verification email has been sent to your email address. Please verify your email before logging in."
    );
    res.redirect("/users/login");
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/users/register");
  }
};

module.exports.verifyEmail = async (req, res) => {
  const { token } = req.query;

  try {
    const user = await User.findOne({ verificationToken: token });
    if (!user) {
      req.flash("error", "Invalid verification token or token has expired.");
      return res.redirect("/users/login");
    }

    user.isVerified = true;
    user.verificationToken = undefined; // Clear the verification token
    await user.save();

    req.flash("success", "Your email has been verified. You can now log in.");
    res.redirect("/users/login");
  } catch (err) {
    req.flash("error", "Something went wrong during the verification process.");
    res.redirect("/users/login");
  }
};

module.exports.loginUser = (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      req.flash("error", info.message || "Login failed");
      return res.redirect("/users/login");
    }

    // Check if the user's email is verified
    if (!user.isVerified) {
      req.flash("error", "Please verify your email before logging in.");
      return res.redirect("/users/login");
    }

    req.logIn(user, (err) => {
      if (err) {
        return next(err);
      }
      req.flash("success", "Welcome back to TourBuddy!");
      const redirectUrl = res.locals.redirectUrl || "/places";
      res.redirect(redirectUrl);
    });
  })(req, res, next);
};

module.exports.logoutUser = (req, res) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
  });
  req.flash("success", "Logged out successfully");
  res.redirect("/places");
};
