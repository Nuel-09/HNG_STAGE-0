require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const { v7: uuidv7, validate: isUuid } = require("uuid");

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const UPSTREAM_TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS || 4000);

const API = {
  genderize: "https://api.genderize.io",
  agify: "https://api.agify.io",
  nationalize: "https://api.nationalize.io"
};

app.use(cors({ origin: "*" }));
app.use(express.json());

const profileSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    normalized_name: { type: String, required: true, unique: true, index: true },
    gender: { type: String, required: true },
    gender_probability: { type: Number, required: true },
    sample_size: { type: Number, required: true },
    age: { type: Number, required: true },
    age_group: { type: String, required: true, enum: ["child", "teenager", "adult", "senior"] },
    country_id: { type: String, required: true },
    country_probability: { type: Number, required: true },
    created_at: { type: Date, required: true, default: () => new Date() }
  },
  { versionKey: false }
);

const Profile = mongoose.model("Profile", profileSchema);

const sendError = (res, statusCode, message) =>
  res.status(statusCode).json({ status: "error", message });

const normalizeName = (name) => name.trim().toLowerCase();

const buildProfileResponse = (doc) => ({
  id: doc.id,
  name: doc.name,
  gender: doc.gender,
  gender_probability: doc.gender_probability,
  sample_size: doc.sample_size,
  age: doc.age,
  age_group: doc.age_group,
  country_id: doc.country_id,
  country_probability: doc.country_probability,
  created_at: new Date(doc.created_at).toISOString()
});

const buildListResponse = (doc) => ({
  id: doc.id,
  name: doc.name,
  gender: doc.gender,
  age: doc.age,
  age_group: doc.age_group,
  country_id: doc.country_id
});

const fetchJsonWithTimeout = async (url) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Upstream returned ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
};

const fetchExternalApi = async (apiName, url) => {
  try {
    return await fetchJsonWithTimeout(url);
  } catch (error) {
    const custom = new Error(`${apiName} returned an invalid response`);
    custom.statusCode = 502;
    throw custom;
  }
};

const classifyAgeGroup = (age) => {
  if (age <= 12) return "child";
  if (age <= 19) return "teenager";
  if (age <= 59) return "adult";
  return "senior";
};

const getTopCountry = (countries) => {
  if (!Array.isArray(countries) || countries.length === 0) return null;
  return countries.reduce((max, current) =>
    current.probability > max.probability ? current : max
  );
};

app.post("/api/profiles", async (req, res) => {
  try {
    const { name } = req.body || {};

    if (name === undefined) {
      return sendError(res, 400, "Missing or empty name");
    }
    if (typeof name !== "string") {
      return sendError(res, 422, "Invalid type");
    }
    const trimmedName = name.trim();
    if (!trimmedName) {
      return sendError(res, 400, "Missing or empty name");
    }

    const normalizedName = normalizeName(trimmedName);
    const existing = await Profile.findOne({ normalized_name: normalizedName });
    if (existing) {
      return res.status(200).json({
        status: "success",
        message: "Profile already exists",
        data: buildProfileResponse(existing)
      });
    }

    const [genderize, agify, nationalize] = await Promise.all([
      fetchExternalApi(
        "Genderize",
        `${API.genderize}?name=${encodeURIComponent(trimmedName)}`
      ),
      fetchExternalApi("Agify", `${API.agify}?name=${encodeURIComponent(trimmedName)}`),
      fetchExternalApi(
        "Nationalize",
        `${API.nationalize}?name=${encodeURIComponent(trimmedName)}`
      )
    ]);

    if (genderize.gender === null || Number(genderize.count || 0) === 0) {
      return sendError(res, 502, "Genderize returned an invalid response");
    }

    if (agify.age === null || agify.age === undefined) {
      return sendError(res, 502, "Agify returned an invalid response");
    }

    const topCountry = getTopCountry(nationalize.country);
    if (!topCountry) {
      return sendError(res, 502, "Nationalize returned an invalid response");
    }

    const newProfile = await Profile.create({
      id: uuidv7(),
      name: trimmedName,
      normalized_name: normalizedName,
      gender: String(genderize.gender).toLowerCase(),
      gender_probability: Number(genderize.probability || 0),
      sample_size: Number(genderize.count || 0),
      age: Number(agify.age),
      age_group: classifyAgeGroup(Number(agify.age)),
      country_id: String(topCountry.country_id).toUpperCase(),
      country_probability: Number(topCountry.probability || 0),
      created_at: new Date()
    });

    return res.status(201).json({
      status: "success",
      data: buildProfileResponse(newProfile)
    });
  } catch (error) {
    if (error?.code === 11000 && error?.keyPattern?.normalized_name) {
      const existing = await Profile.findOne({
        normalized_name: normalizeName(String(req.body?.name || ""))
      });
      if (existing) {
        return res.status(200).json({
          status: "success",
          message: "Profile already exists",
          data: buildProfileResponse(existing)
        });
      }
    }
    if (error?.statusCode) {
      return sendError(res, error.statusCode, error.message);
    }
    return sendError(res, 500, "Internal server error");
  }
});

app.get("/api/profiles/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) {
      return sendError(res, 404, "Profile not found");
    }

    const profile = await Profile.findOne({ id });
    if (!profile) {
      return sendError(res, 404, "Profile not found");
    }

    return res.status(200).json({
      status: "success",
      data: buildProfileResponse(profile)
    });
  } catch (error) {
    return sendError(res, 500, "Internal server error");
  }
});

app.get("/api/profiles", async (req, res) => {
  try {
    const query = {};
    const { gender, country_id: countryId, age_group: ageGroup } = req.query;

    if (gender !== undefined) {
      if (typeof gender !== "string") return sendError(res, 422, "Invalid type");
      query.gender = gender.toLowerCase();
    }
    if (countryId !== undefined) {
      if (typeof countryId !== "string") return sendError(res, 422, "Invalid type");
      query.country_id = countryId.toUpperCase();
    }
    if (ageGroup !== undefined) {
      if (typeof ageGroup !== "string") return sendError(res, 422, "Invalid type");
      query.age_group = ageGroup.toLowerCase();
    }

    const profiles = await Profile.find(query).sort({ created_at: -1 });

    return res.status(200).json({
      status: "success",
      count: profiles.length,
      data: profiles.map(buildListResponse)
    });
  } catch (error) {
    return sendError(res, 500, "Internal server error");
  }
});

app.delete("/api/profiles/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) {
      return sendError(res, 404, "Profile not found");
    }
    const deleted = await Profile.findOneAndDelete({ id });
    if (!deleted) {
      return sendError(res, 404, "Profile not found");
    }
    return res.status(204).send();
  } catch (error) {
    return sendError(res, 500, "Internal server error");
  }
});

const startServer = async () => {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is required");
  }
  await mongoose.connect(MONGODB_URI);
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
