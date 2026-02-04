const mongoose = require('mongoose');

const PepSchema = new mongoose.Schema({
    recordId: { type: String, required: true, unique: true },
    recordType: String,
    dataSource: String,
    fullName: { type: String, index: true }, // Indexed for fast searching
    primaryName: String,
    aliases: [String],
    countries: [String],
    category: String,
    dates: [mongoose.Schema.Types.Mixed],
    addresses: [mongoose.Schema.Types.Mixed],
    sourceLinks: [String],
    url: String,
    lastChange: Date,
    rawRecord: mongoose.Schema.Types.Mixed // Optional: keep the original JSON
}, { timestamps: true });

// Add a text index for fuzzy-like searching later
PepSchema.index({ fullName: 'text', aliases: 'text' });

module.exports = mongoose.model('Pep', PepSchema);