import express from "express";
import process from "node:process";
import helmet from "helmet";
import bodyParser from "body-parser";
import bcrypt from "bcrypt";
import cors from "cors";
import jwt from "jsonwebtoken";
import Transaction from "./models/Transaction.js";
import connectServer from "./connectServer.js";
import dotenv from "dotenv";
import User from "./models/User.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.set("port", PORT);
app.use(helmet());
app.use(bodyParser.json());
app.use(cors());

//connect to MongoDB
connectServer();

//add users
app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;
  try {
    //check if user already  exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exist" });
    }
    // create a new user
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
    });
    const savedUser = await newUser.save();

    res.status(201).json({
      message: `Welcome ${username}`,
      newUserData: savedUser,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to register",
      error: error.message,
    });
  }
});

//User Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    //Find the user
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "Email not found" });
    }
    //Check Password
    const matchPassword = await bcrypt.compare(password, user.password);
    if (!matchPassword) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: "Account is inactive" });
    }

    //Generate JWT Token and send it back with response
    const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: "1h",
    });
    res.status(200).json({ token });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

//Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const token = req.headers["authorization" || "Authorization"]?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "No provided token" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decode) => {
    if (err) {
      return res.status(403).json({ message: "Invalid token" });
    }
    req.email = decode.email;

    next();
  });
};

app.get("/protected", authenticateToken, async (req, res) => {
  //access user object
  const email = req.email;
  const user = await User.find({ email }, { _id: 1, email: 1, username: 1 });
  res.json({ message: "Protected route", data: user });
});

// deactivate account
app.put("/api/v1/user/deactivate", authenticateToken, async (req, res) => {
  try {
    //Retrieve the user account from the database
    const email = req.email;
    const user = await User.findOne(
      { email },
      { _id: 1, email: 1, username: 1 }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    //Deactivate account if found set the isActive as false;
    user.isActive = false;

    await user.save();

    res.status(200).json({ message: "Account is deactivated" });
  } catch (error) {
    res.status(500).json({
      message: "An error occured while deactivating the account",
      error: error.message,
    });
  }
});

// activate account
app.put("/api/v1/user/activate/:id", async (req, res) => {
  const userId = req.params.id;

  try {
    //Retrieve the user account from the database
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    //Deactivate account if found set the isActive as true;
    user.isActive = true;

    await user.save();
    res.status(200).json({ message: "Account is Activated" });
  } catch (error) {
    res.status(500).json({
      message: "An error occured while Activating the account",
      error: error.message,
    });
  }
});

//change password
app.put("/api/v1/changepassword/", authenticateToken, async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  try {
    //Retrieve the user account from the database
    const email = req.email;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    //verify the current password
    const passwordMatch = await bcrypt.compare(oldPassword, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Incorrect current password" });
    }

    //Generate new hashed password
    const newPasswordHashed = await bcrypt.hash(newPassword, 10);

    //Update the user's password
    user.password = newPasswordHashed;

    await user.save();
    res.status(200).json({ message: "Password change successful" });
  } catch (error) {
    res.status(500).json({
      message: "An error occured while changing the password",
      error: error.message,
    });
  }
});

app.get("/api/v1/users", async (req, res) => {
  res.status(200).json({
    users: await User.find(),
  });
});

//add Transaction
app.post("/api/v1/addtransaction", authenticateToken, async (req, res) => {
  try {
    //Retrieve the user account from the database
    const email = req.email;
    const user = await User.findOne(
      { email },
      { _id: 1, email: 1, username: 1 }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { categoryName, categoryImageLink, transactionType, amount, date } =
      req.body;

    const userId = user._id;

    const findUserId = await User.findOne({ _id: userId });
    if (!findUserId) {
      return res.status(400).json({
        message: `User not found`,
      });
    }

    const newTransaction = new Transaction({
      userId: userId,
      categoryName,
      categoryImageLink,
      transactionType,
      amount,
      date,
    });
    const savedTransaction = await newTransaction.save();
    res.status(201).json({ newTransaction: savedTransaction });
  } catch (error) {
    console.error("Error creating transaction", error);
    res.status(500).json({ error: "Server eerror", error: error.message });
  }
});

// get income of user
app.get("/api/v1/income", authenticateToken, async (req, res) => {
  try {
    //Retrieve the user account from the database
    const email = req.email;
    const user = await User.findOne(
      { email },
      { _id: 1, email: 1, username: 1 }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const userId = user._id;

    const { transactionType } = req.query;

    const incomeTransactions = await Transaction.find({
      transactionType: JSON.parse(transactionType),
      userId: userId,
    }).populate("userId", "username");

    if (incomeTransactions.length === 0) {
      return res.status(200).json({
        message: `No transactions found for ${user.username}`,
      });
    }

    res.status(201).json({ data: incomeTransactions });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// get expenses of user
app.get("/api/v1/expense", authenticateToken, async (req, res) => {
  try {
    //Retrieve the user account from the database
    const email = req.email;
    const user = await User.findOne(
      { email },
      { _id: 1, email: 1, username: 1 }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const userId = user._id;
    const { transactionType } = req.query;

    const expenseTransactions = await Transaction.find({
      transactionType: transactionType === false,
      userId: userId,
    }).populate("userId", "username");

    if (expenseTransactions.length === 0) {
      return res.status(200).json({
        message: `No transactions found for ${user.username}`,
      });
    }

    res.status(201).json({ data: expenseTransactions });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.get("/api/v1/transactions", authenticateToken, async (req, res) => {
  try {
    //Retrieve the user account from the database
    const email = req.email;
    const user = await User.findOne(
      { email },
      { _id: 1, email: 1, username: 1 }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const userId = user._id;

    const allTransaction = await Transaction.find({ userId: userId }).populate(
      "userId",
      "username"
    );
    res.status(201).json({ data: allTransaction });
  } catch (error) {
    console.error("Error getting transaction", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`App is listening to port ${PORT}`);
});
