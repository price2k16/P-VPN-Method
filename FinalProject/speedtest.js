// Function to start the speed test 
async function initSpeedTest() {
    // grab the DOM elements to show results
    let downloadOutput = document.getElementById("download");
    let uploadOutput = document.getElementById("upload");
    let latencyOutput = document.getElementById("latency");

    // make sure those elements actually exist
    if (!downloadOutput || !uploadOutput || !latencyOutput) {
        console.error("One or more output elements are missing from the DOM.");
        return;
    }

    // set placeholder text while test is running
    downloadOutput.innerHTML = "Testing...";
    uploadOutput.innerHTML = "Testing...";
    latencyOutput.innerHTML = "Testing...";

    try {
        // get the latency and display it
        let latency = await measureLatency();
        latencyOutput.innerHTML = latency !== "N/A" ? `${latency} ms` : "Error";

        // get download speed and display
        let downloadSpeed = await measureDownloadSpeed();
        downloadOutput.innerHTML = downloadSpeed.mbps > 0 ? `${downloadSpeed.mbps} Mbps` : "Error";

        // get upload speed and display
        let uploadSpeed = await measureUploadSpeed();
        uploadOutput.innerHTML = uploadSpeed.mbps > 0 ? `${uploadSpeed.mbps} Mbps` : "Error";

        // if all goes well, save results to localStorage
        if (latency !== "N/A" && downloadSpeed.mbps > 0 && uploadSpeed.mbps > 0) {
            saveTestResult(downloadSpeed.mbps, uploadSpeed.mbps, latency);
        }

    } catch (error) {
        // show error messages if something goes wrong
        console.error("Error during speed test:", error);
        downloadOutput.innerHTML = "Error";
        uploadOutput.innerHTML = "Error";
        latencyOutput.innerHTML = "Error";
    }
}

// Function to save results to localStorage
function saveTestResult(downloadMbps, uploadMbps, latencyMs) {
    // get existing history or start a new array
    const history = JSON.parse(localStorage.getItem("speedTestHistory")) || [];

    // add new test result to history
    history.push({
        date: new Date().toLocaleString(),
        download: `${downloadMbps} Mbps`,
        upload: `${uploadMbps} Mbps`,
        latency: `${latencyMs} ms`
    });

    // save updated history back to localStorage
    localStorage.setItem("speedTestHistory", JSON.stringify(history));
}

// Function to measure latency 
async function measureLatency() {
    try {
        let startTime = performance.now();
        // using 1.1.1.1 to ping for latency
        await fetch("https://1.1.1.1/cdn-cgi/trace", { cache: "no-store" });
        let endTime = performance.now();
        return (endTime - startTime).toFixed(2); // return latency
    } catch (error) {
        console.error("Latency test failed:", error);
        return "N/A"; // fallback if something goes wrong
    }
}

// Function to measure download speed 
async function measureDownloadSpeed() {
    // list of test files from different servers
    let testFiles = [
        "https://speed.cloudflare.com/__down?bytes=10485760",
        "https://speed.hetzner.de/10MB.bin",
        "https://proof.ovh.net/files/10Mb.dat"
    ];
    let startTime, endTime, receivedBytes = 0;

    // try each file until one works
    for (let file of testFiles) {
        try {
            console.log(`Trying download test from: ${file}`);
            startTime = performance.now();
            let response = await fetch(file, { cache: "no-store" });

            if (!response.ok) throw new Error(`Failed to fetch ${file} - Status: ${response.status}`);

            let reader = response.body.getReader();
            let done = false;

            // read the file chunk by chunk
            while (!done) {
                let { done: finished, value } = await reader.read();
                if (value) receivedBytes += value.length;
                done = finished;
            }

            endTime = performance.now();
            console.log(`✅ Download test successful from: ${file}`);
            return calculateSpeed(receivedBytes, startTime, endTime);
        } catch (error) {
            console.warn(` Download test failed for ${file}, trying next...`, error.message);
        }
    }

    console.error(" All download tests failed.");
    return { bps: 0, kbps: 0, mbps: 0 }; // return zero if nothing worked
}

// Function to measure upload speed
async function measureUploadSpeed() {
    // create dummy data to upload (2MB)
    let uploadData = new Blob(["A".repeat(2 * 1024 * 1024)]);
    let startTime, endTime;

    try {
        console.log("Starting upload speed test...");
        startTime = performance.now();

        // send the data to test server
        let response = await fetch("https://speed.cloudflare.com/__up", {
            method: "POST",
            body: uploadData
        });

        if (!response.ok) throw new Error(`Upload test failed - Status: ${response.status}`);

        endTime = performance.now();
        console.log(" Upload speed test successful.");
        return calculateSpeed(uploadData.size, startTime, endTime);
    } catch (error) {
        console.error("Upload test failed:", error);
        return { bps: 0, kbps: 0, mbps: 0 };
    }
}

// Function to calculate speed based on size and duration
function calculateSpeed(size, start, end) {
    let duration = (end - start) / 1000; 
    let bits = size * 8;
    
    return {
        bps: (bits / duration).toFixed(2),
        kbps: (bits / (1024 * duration)).toFixed(2),
        mbps: (bits / (1024 * 1024 * duration)).toFixed(2)
    };
}

// Function to check if the user can run a speed test (limit: 5 tests per 10 minutes)
function canRunSpeedTest() {
    const now = Date.now(); // current time in milliseconds
    const saved = localStorage.getItem("speedTestTimestamps");
    const timestamps = saved ? JSON.parse(saved) : [];

    // Keep only timestamps from the last 10 minutes (600,000 ms)
    const recent = timestamps.filter(ts => now - ts < 10 * 60 * 1000);

    // If the user has already done 5 tests, block the test
    if (recent.length >= 5) {
        alert("You’ve reached the limit of 5 speed tests in 10 minutes. Please wait a while before trying again.");
        return false;
    }

    // Add current timestamp and save back to localStorage
    recent.push(now);
    localStorage.setItem("speedTestTimestamps", JSON.stringify(recent));
    return true;
}


// run speed test when the page is loaded and user clicks start
document.addEventListener("DOMContentLoaded", function () {
    document.querySelector('.startButton').addEventListener('click', () => {
        if (canRunSpeedTest()) {
            initSpeedTest(); // run the test only if not rate-limited
        }
    });
    
});

// load and show history table on page load
document.addEventListener("DOMContentLoaded", function () {
    const history = JSON.parse(localStorage.getItem("speedTestHistory")) || [];
    const tableBody = document.getElementById("historyTable");

    if (history.length === 0) {
        // show message if there's no data
        const row = document.createElement("tr");
        row.innerHTML = '<td colspan="4">No test history available.</td>';
        tableBody.appendChild(row);
    } else {
        // add each test to the table
        history.reverse().forEach(test => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${test.date}</td>
                <td>${test.download}</td>
                <td>${test.upload}</td>
                <td>${test.latency}</td>
            `;
            tableBody.appendChild(row);
        });
    }
});

// Function to clear the table's history
function clearHistory() {
    // ask the user before deleting everything
    if (confirm("Are you sure you want to clear your test history?")) {
        localStorage.removeItem('speedTestHistory'); // remove from localStorage
        location.reload(); // refresh to update the table
    }
}
