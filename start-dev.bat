@echo off
cd /d "%~dp0"
echo Starting ABCAI dev server...

:: Start the server in the background, log to file
start /B node node_modules/next/dist/bin/next dev > dev-out.log 2> dev-err.log

:: Wait for server to be ready
echo Waiting for server...
:WAIT
timeout /t 2 /nobreak >nul
findstr /C:"Ready in" dev-out.log >nul 2>&1
if errorlevel 1 goto WAIT

echo Server ready! Pre-compiling pages...

:: Pre-compile both pages so first click is instant
node -e "const http=require('http');function get(p){http.get('http://localhost:3000'+p,r=>{console.log('Compiled '+p+' ('+r.statusCode+')')}).on('error',()=>{})}; setTimeout(()=>get('/'),500); setTimeout(()=>get('/dataset-builder'),3000);"

:: Wait for pre-compile to finish (dataset-builder takes ~30s)
echo Waiting for pages to pre-compile (this takes ~35 seconds)...
timeout /t 40 /nobreak >nul

echo.
echo ==========================================
echo  ABCAI is ready at http://localhost:3000
echo  Keep this window open while using the app
echo ==========================================
echo.

:: Keep window open and tail the log
node -e "const fs=require('fs');let s=fs.statSync('dev-out.log').size;setInterval(()=>{const n=fs.statSync('dev-out.log').size;if(n>s){const f=fs.openSync('dev-out.log','r');const b=Buffer.alloc(n-s);fs.readSync(f,b,0,n-s,s);fs.closeSync(f);process.stdout.write(b);s=n;}},500);"
