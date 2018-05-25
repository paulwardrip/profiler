
let request = require('request');
let fs = require('fs');
let conf = require("./conf");
let moment = require("moment");

let start = moment();
let lastwrite = moment();

let fnsuffix = start.format("YYYYMMDDHHmm");

conf.requests.completed = 0;

// perform some calculations to get the interval and estimated time to complete the job.
conf.requests.interval = (conf.requests.perxsec * 1000) / conf.requests.requests;
conf.requests.runtime = ((conf.requests.total * conf.requests.interval) / (1000 * 60)) + " minutes";
conf.requests.started = start.format("MM/DD/YYYY HH:mm:ss");

conf.resulting = {
    errors: 0,
    status: {}
};

let opts = {
    url: conf.url,
    headers: {
        Authorization: "Bearer " + conf.bearer
    },
    strictSSL: false
};

function requester() {
    conf.requests.completed++;

    // this is the final run, clear the interval and set lastwrite to null to bypass the file io throttling.
    if (conf.requests.completed >= conf.requests.total) {
        clearInterval(job);
        lastwrite = null;
    }

    // when the interval is short enough, extra requests might try to go through before the clear happens.
    if (conf.requests.completed <= conf.requests.total) {
        request(opts, function (error, response, body) {
            if (error) {
                conf.resulting.errors++;
            } else {
                // the results are counted based on status code into the object that gets written to the file.
                if (!conf.resulting.status[response.statusCode]) {
                    conf.resulting.status[response.statusCode] = 1;
                } else {
                    conf.resulting.status[response.statusCode]++;
                }
            }

            writeResulting();
        });
    }
}

function writeResulting() {
    // We call this every time the data updates, so we can have real-time results available if you setup
    // a long-running job, but the actual writes to the output file are throttled.

    // Only writes once every 10 seconds or when the job is complete.
    let writenow = moment();
    if (!lastwrite || writenow.diff(lastwrite) > 10000) {
        fs.writeFile("results/resulting" + fnsuffix + ".json", JSON.stringify(conf, null, 2), function (err) {
            // whatever
        });
        lastwrite = writenow;
    }
}

console.log ("Running", conf.requests.total, "requests, one every", conf.requests.interval,
    "ms for the next", conf.requests.runtime);

let job = setInterval(requester, conf.requests.interval);