const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;
const GENDERIZE_API_URL = "https://api.genderize.io";
const UPSTREAM_TIMEOUT_MS = 3000;

app.use(cors({ origin: "*" }));
app.use(express.json());

const sendError = (res, statusCode, message) => {
  return res.status(statusCode).json({
    status: "error",
    message
  });
};

const fetchGenderizePrediction = async (name) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const endpoint = `${GENDERIZE_API_URL}?name=${encodeURIComponent(name)}`;
    const response = await fetch(endpoint, { signal: controller.signal });

    if (!response.ok) {
      throw new Error("Upstream Genderize API returned non-2xx response");
    }

    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
};

app.get("/api/classify", async (req, res) => {
  try {
    const { name } = req.query;

    if (name === undefined) {
      return sendError(res, 400, "name query parameter is required");
    }

    if (typeof name !== "string") {
      return sendError(res, 422, "name must be a string");
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      return sendError(res, 400, "name query parameter is required");
    }

    let genderizeData;
    try {
      genderizeData = await fetchGenderizePrediction(trimmedName);
    } catch (error) {
      return sendError(res, 502, "Unable to fetch prediction from Genderize API");
    }

    const {
      gender,
      probability = 0,
      count = 0
    } = genderizeData;

    if (gender === null || count === 0) {
      return sendError(
        res,
        422,
        "No prediction available for the provided name"
      );
    }

    const sampleSize = count;
    const isConfident = probability >= 0.7 && sampleSize >= 100;

    return res.status(200).json({
      status: "success",
      data: {
        name: trimmedName,
        gender,
        probability,
        sample_size: sampleSize,
        is_confident: isConfident,
        processed_at: new Date().toISOString()
      }
    });
  } catch (error) {
    return sendError(res, 500, "Internal server error");
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
