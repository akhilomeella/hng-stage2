const { createCanvas } = require("canvas");
const fs = require("fs").promises;

async function generateSummaryImage(stats) {
  const width = 800;
  const height = 600;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, width, height);

  // Title
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 32px Arial";
  ctx.fillText("Country Data Summary", 50, 60);

  // Total countries
  ctx.font = "24px Arial";
  ctx.fillStyle = "#00d9ff";
  ctx.fillText(`Total Countries: ${stats.total}`, 50, 120);

  // Last refreshed
  ctx.fillStyle = "#ffffff";
  ctx.font = "18px Arial";
  ctx.fillText(`Last Refreshed: ${stats.timestamp}`, 50, 160);

  // Top 5 countries by GDP
  ctx.fillStyle = "#00ff88";
  ctx.font = "bold 24px Arial";
  ctx.fillText("Top 5 Countries by Estimated GDP", 50, 220);

  ctx.fillStyle = "#ffffff";
  ctx.font = "18px Arial";
  let y = 260;
  stats.topCountries.forEach((country, index) => {
    const gdp = country.estimated_gdp
      ? `$${(country.estimated_gdp / 1e9).toFixed(2)}B`
      : "N/A";
    ctx.fillText(`${index + 1}. ${country.name} - ${gdp}`, 70, y);
    y += 40;
  });

  // Save image
  const buffer = canvas.toBuffer("image/png");
  const filePath = path.join(__dirname, "summary.png");
  await fs.writeFile(filePath, buffer);
}

module.exports = generateSummaryImage;
