const fs = require('fs');
let c = fs.readFileSync('src/App.tsx', 'utf8');

const startMarker = "      {/* Floating Download Progress Widget */}";
const endMarker = "      )}\n\n      {/* Mobile Header Topbar */}";
const endMarkerCRLF = "      )}\r\n\r\n      {/* Mobile Header Topbar */}";

let startIdx = c.indexOf(startMarker);
if (startIdx !== -1) {
    let endIdx = c.indexOf(endMarker, startIdx);
    if (endIdx === -1) {
        endIdx = c.indexOf(endMarkerCRLF, startIdx);
    }
    
    if (endIdx !== -1) {
        c = c.substring(0, startIdx) + "      {/* Mobile Header Topbar */}" + c.substring(endIdx + endMarker.length);
        fs.writeFileSync('src/App.tsx', c);
        console.log("Successfully removed old widget.");
    } else {
        console.log("Could not find end marker.");
    }
} else {
    console.log("Could not find start marker.");
}
