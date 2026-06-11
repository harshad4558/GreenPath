import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AppDataSource } from "../config/db.js";
import { User } from "../entities/UserAndPreferences.js";
import { EcoScore } from "../entities/EcoScore.js";

const JWT_SECRET = process.env.JWT_SECRET || "greenpath_super_secret_key_12345";
const JWT_EXPIRES_IN = "7d";

export const signup = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const userRepository = AppDataSource.getRepository(User);
    const existingUser = await userRepository.findOne({ where: { email } });

    if (existingUser) {
      return res.status(400).json({ message: "A user with this email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = userRepository.create({
      email,
      password: hashedPassword,
      role: role === "ADMIN" ? "ADMIN" : "USER", // default to USER
    });

    const savedUser = await userRepository.save(newUser);

    // Initialize EcoScore for the new user
    const ecoScoreRepository = AppDataSource.getRepository(EcoScore);
    const initialEcoScore = ecoScoreRepository.create({
      user: savedUser,
      totalPoints: 0,
      co2Saved: 0.0,
      totalTrips: 0,
    });
    await ecoScoreRepository.save(initialEcoScore);

    // Generate JWT token
    const token = jwt.sign(
      { id: savedUser.id, email: savedUser.email, role: savedUser.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(201).json({
      message: "User registered successfully.",
      token,
      user: {
        id: savedUser.id,
        email: savedUser.email,
        role: savedUser.role,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({ message: "Internal server error during registration." });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({ where: { email } });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.json({
      message: "Login successful.",
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Internal server error during login." });
  }
};

export const getProfile = async (req, res) => {
  try {
    const userRepository = AppDataSource.getRepository(User);
    const ecoScoreRepository = AppDataSource.getRepository(EcoScore);

    const user = await userRepository.findOne({
      where: { id: req.user.id },
      select: ["id", "email", "role", "createdAt"],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const ecoScore = await ecoScoreRepository.findOne({
      where: { user: { id: user.id } },
      order: { lastUpdated: "DESC" },
    });

    return res.json({
      user,
      ecoScore: ecoScore || { totalPoints: 0, co2Saved: 0.0, totalTrips: 0 },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return res.status(500).json({ message: "Internal server error retrieving user profile." });
  }
};
