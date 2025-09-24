
const Joi = require('joi');

// Define the schema for the entire configuration using Joi.
// This provides default values and ensures all required fields are present and correctly typed.
const configSchema = Joi.object({
    mqtt: Joi.object({
        url: Joi.string().uri({ scheme: ['mqtt', 'mqtts'] }).required(),
        topics: Joi.array().items(Joi.string()).min(1).required(),
        options: Joi.object({
            clientId: Joi.string().required(),
            username: Joi.string().allow(''),
            password: Joi.string().allow(''),
            clean: Joi.boolean().default(false),
            connectTimeout: Joi.number().integer().positive().default(10000),
            reconnectPeriod: Joi.number().integer().positive().default(5000),
            keepalive: Joi.number().integer().positive().default(60)
        }).required(),
        tls: Joi.object({
            rejectUnauthorized: Joi.boolean().default(true),
            ca: Joi.array().items(Joi.string()),
            cert: Joi.string(),
            key: Joi.string()
        }).optional()
    }).required(),

    socketio: Joi.object({
        port: Joi.number().port().required(),
        options: Joi.object({
            cors: Joi.object({
                origin: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).default('*'),
                methods: Joi.array().items(Joi.string()).default(['GET', 'POST'])
            }).default(),
            pingInterval: Joi.number().integer().positive().default(10000),
            pingTimeout: Joi.number().integer().positive().default(5000)
        }).default()
    }).required(),

    queue: Joi.object({
        enabled: Joi.boolean().default(true),
        maxSize: Joi.number().integer().min(0).default(1000)
    }).default(),

    log: Joi.object({
        level: Joi.string().valid('error', 'warn', 'info', 'debug').default('info')
    }).default()
}).unknown(false); // Disallow any properties not defined in the schema

/**
 * Validates the raw configuration object against the defined schema.
 * @param {object} config - The raw config object parsed from TOML.
 * @returns {{value: object, error: object}} - The validated and defaulted config, or an error.
 */
function validateConfig(config) {
    return configSchema.validate(config, { abortEarly: false });
}

module.exports = { validateConfig };
