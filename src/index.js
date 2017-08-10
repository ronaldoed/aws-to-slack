"use strict";

const BbPromise = require("bluebird"),
	_ = require("lodash"),
	Slack = require("./slack");

function processIncoming(event) {
	const GenericParser = require("./parsers/generic");
	const parsers = [
		require("./parsers/cloudwatch"),
		require("./parsers/rds"),
		require("./parsers/beanstalk")
	];

	// Execute all parsers and use the first successful result
	return BbPromise.any(_.map(parsers, Parser => {
		if (_.isEmpty(event)) {
			return BbPromise.resolve();
		}

		const parser = new Parser();
		return parser.parse(event)
		.then(result => result ? result : BbPromise.reject()); // reject on empty result
	}))
	.catch(err => {
		console.log("Error while parsing message:", err);

		// Fallback to the generic parser if none other succeeded
		const parser = new GenericParser();
		return parser.parse(event);
	})
	.then(message => {
		// Finally forward the message to Slack
		if (_.isEmpty(message)) {
			console.log("Skipping empty message.");
			return BbPromise.resolve();
		}

		// console.log("Sending Message to Slack:", JSON.stringify(message, null, 2));
		return Slack.postMessage(message);
	});
}

module.exports.handler = (event, context, callback) => {
	context.callbackWaitsForEmptyEventLoop = false;

	// no return here as we're invoking the callback directly
	console.log("Incoming Message:", JSON.stringify(event, null, 2));
	BbPromise.resolve(processIncoming(event)).asCallback(callback);
};