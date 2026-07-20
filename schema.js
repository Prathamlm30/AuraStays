const BaseJoi = require("joi");
const sanitizeHtml = require("sanitize-html");

// ==========================================
// THE INPUT CLEANSER (XSS PROTECTION)
// ==========================================
// This extension creates a new rule called .escapeHTML()
const extension = (joi) => ({
    type: "string",
    base: joi.string(),
    messages: {
        "string.escapeHTML": "{{#label}} must not include HTML or script tags!",
    },
    rules: {
        escapeHTML: {
            validate(value, helpers) {
                // Sanitize the input by removing ALL html tags and attributes
                const clean = sanitizeHtml(value, {
                    allowedTags: [],
                    allowedAttributes: {},
                });
                
                // If the cleaned string is different from the original, someone tried to inject HTML!
                if (clean !== value) {
                    return helpers.error("string.escapeHTML", { value });
                }
                return clean;
            },
        },
    },
});

// Extend the base Joi with our new security extension
const Joi = BaseJoi.extend(extension);

// ==========================================
// VALIDATION SCHEMAS
// ==========================================

module.exports.listingSchema = Joi.object({
    listing : Joi.object({
        title: Joi.string().required().escapeHTML(),
        description: Joi.string().required().escapeHTML(),
        location: Joi.string().required().escapeHTML(),
        country: Joi.string().required().escapeHTML(),
        price: Joi.number().required().min(0),
        image: Joi.string().allow("",null),
        category: Joi.string().required().escapeHTML() 
    }).required(),
});

module.exports.reviewSchema = Joi.object({
    review: Joi.object({
        rating: Joi.number().required().min(1).max(5),
        comment: Joi.string().required().escapeHTML(),
    }).required(),
});