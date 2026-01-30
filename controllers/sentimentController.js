const { spawn } = require('child_process');
const path = require('path');

exports.analyzeText = (req, res) => {
    const { text, title } = req.body;

    if (!text) {
        return res.status(400).json({
            sentiment: 'NEUTRAL',
            confidence: 0,
            scores: {
                positive: 0,
                negative: 0,
                neutral: 100,
                compound: 0
            }
        });
    }

    // Call Python sentiment analysis script
    const pythonProcess = spawn('python', [
        path.join(__dirname, '../nlp/analyze_text.py')
    ]);

    let output = '';
    let errorOutput = '';

    // Send text to Python via stdin
    pythonProcess.stdin.write(JSON.stringify({ text, title }));
    pythonProcess.stdin.end();

    pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
    });

    pythonProcess.on('close', (code) => {
        if (code !== 0) {
            console.error('Python error:', errorOutput);
            return res.status(500).json({
                sentiment: 'NEUTRAL',
                confidence: 0,
                scores: {
                    positive: 0,
                    negative: 0,
                    neutral: 100,
                    compound: 0
                }
            });
        }

        try {
            const result = JSON.parse(output.trim());
            res.json(result);
        } catch (e) {
            console.error('Parse error:', e, 'Output:', output);
            res.status(500).json({
                sentiment: 'NEUTRAL',
                confidence: 0,
                scores: {
                    positive: 0,
                    negative: 0,
                    neutral: 100,
                    compound: 0
                }
            });
        }
    });

    pythonProcess.on('error', (err) => {
        console.error('Process error:', err);
        res.status(500).json({
            sentiment: 'NEUTRAL',
            confidence: 0,
            scores: {
                positive: 0,
                negative: 0,
                neutral: 100,
                compound: 0
            }
        });
    });
};

// GET endpoint for market insights (returns sample insights for watchlist)
exports.getMarketInsights = (req, res) => {
    const insights = [
        { symbol: 'AAPL', sentiment: 'bullish', confidence: 0.82, analysis: 'Strong uptrend with positive earnings outlook' },
        { symbol: 'MSFT', sentiment: 'bullish', confidence: 0.78, analysis: 'AI integration driving growth prospects' },
        { symbol: 'TSLA', sentiment: 'neutral', confidence: 0.65, analysis: 'Mixed signals from market analysts' },
        { symbol: 'GOOGL', sentiment: 'bullish', confidence: 0.75, analysis: 'Cloud services expansion shows promise' },
        { symbol: 'AMZN', sentiment: 'bullish', confidence: 0.80, analysis: 'Stable growth in AWS and retail segments' }
    ];
    res.json({ insights, success: true });
};
