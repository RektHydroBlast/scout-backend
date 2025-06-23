# MCP Server Test Runner
# This script runs comprehensive tests for the MCP server functionality

Write-Host "🚀 MCP Server Test Suite" -ForegroundColor Green
Write-Host "========================" -ForegroundColor Green

# Check if Node.js is available
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found. Please install Node.js first." -ForegroundColor Red
    exit 1
}

# Check if we're in the correct directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ package.json not found. Please run this script from the backend directory." -ForegroundColor Red
    exit 1
}

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "⚠️ .env file not found. Make sure NODIT_API_KEY is configured." -ForegroundColor Yellow
} else {
    Write-Host "✅ .env file found" -ForegroundColor Green
}

# Build the project first
Write-Host "`n🔨 Building the project..." -ForegroundColor Cyan
try {
    npm run build
    Write-Host "✅ Build successful" -ForegroundColor Green
} catch {
    Write-Host "❌ Build failed. Please check for compilation errors." -ForegroundColor Red
    exit 1
}

# Ask user which test to run
Write-Host "`n📋 Select test to run:" -ForegroundColor Cyan
Write-Host "1. Quick MCP Connectivity Test (recommended first)" -ForegroundColor White
Write-Host "2. Comprehensive MCP Functionality Test" -ForegroundColor White
Write-Host "3. Both tests (sequential)" -ForegroundColor White
Write-Host "4. Exit" -ForegroundColor White

$choice = Read-Host "`nEnter your choice (1-4)"

switch ($choice) {
    "1" {
        Write-Host "`n🔧 Running Quick MCP Connectivity Test..." -ForegroundColor Cyan
        node test-mcp-quick.js
    }
    "2" {
        Write-Host "`n🧪 Running Comprehensive MCP Functionality Test..." -ForegroundColor Cyan
        Write-Host "⚠️ This test may take several minutes to complete." -ForegroundColor Yellow
        node test-mcp-comprehensive.js
    }
    "3" {
        Write-Host "`n🔧 Running Quick MCP Connectivity Test first..." -ForegroundColor Cyan
        $quickResult = node test-mcp-quick.js
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "`n✅ Quick test passed. Starting comprehensive test..." -ForegroundColor Green
            Write-Host "`n🧪 Running Comprehensive MCP Functionality Test..." -ForegroundColor Cyan
            node test-mcp-comprehensive.js
        } else {
            Write-Host "`n❌ Quick test failed. Skipping comprehensive test." -ForegroundColor Red
            Write-Host "Please fix connectivity issues before running comprehensive tests." -ForegroundColor Yellow
        }
    }
    "4" {
        Write-Host "`nExiting..." -ForegroundColor Yellow
        exit 0
    }
    default {
        Write-Host "`n❌ Invalid choice. Exiting." -ForegroundColor Red
        exit 1
    }
}

# Final status
if ($LASTEXITCODE -eq 0) {
    Write-Host "`n🎉 Test execution completed successfully!" -ForegroundColor Green
} else {
    Write-Host "`n💥 Test execution failed. Check the output above for details." -ForegroundColor Red
}

Write-Host "`n📝 Test Results Summary:" -ForegroundColor Cyan
Write-Host "- Check the console output above for detailed test results" -ForegroundColor White
Write-Host "- If tests fail, verify your NODIT_API_KEY and network connection" -ForegroundColor White
Write-Host "- For debugging, check the logs for specific error messages" -ForegroundColor White

Read-Host "`nPress Enter to exit"
