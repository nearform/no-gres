module.exports = {
    coverage: true,
    threshold: 100,
    globals: 'queueMicrotask' // ignoring for Node 12 with lab (not a test issue), remove when lab is replaced by tap
}
