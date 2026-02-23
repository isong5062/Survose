import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(frontendDir, '..')
const survoseScriptPath = path.join(repoRoot, 'src', 'survose.py')

function survoseRunApiPlugin() {
  return {
    name: 'survose-run-api',
    configureServer(server) {
      server.middlewares.use('/api/surveys/run', (req, res, next) => {
        if (req.method !== 'POST') {
          next()
          return
        }

        let rawBody = ''
        req.on('data', (chunk) => {
          rawBody += chunk.toString()
        })

        req.on('end', () => {
          let surveyId = null
          if (rawBody.trim()) {
            try {
              const payload = JSON.parse(rawBody)
              surveyId = payload?.surveyId ?? null
            } catch (error) {
              // Ignore parse failures; the script currently does not need request payload.
            }
          }

          const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'
          const python = spawn(pythonCmd, [survoseScriptPath], {
            cwd: repoRoot,
            env: process.env,
          })

          let stdout = ''
          let stderr = ''

          python.stdout.on('data', (chunk) => {
            stdout += chunk.toString()
          })

          python.stderr.on('data', (chunk) => {
            stderr += chunk.toString()
          })

          python.on('error', (error) => {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ detail: `Failed to execute survose.py: ${error.message}` }))
          })

          python.on('close', (code) => {
            res.setHeader('Content-Type', 'application/json')

            if (code !== 0) {
              const detail = (stderr || stdout || `survose.py failed with exit code ${code}`).trim()
              res.statusCode = 500
              res.end(JSON.stringify({ detail }))
              return
            }

            let question = null
            let transcription = null
            let callSid = null
            const resultPrefix = 'SURVOSE_RESULT:'
            for (const line of stdout.split('\n')) {
              if (line.startsWith(resultPrefix)) {
                try {
                  const parsed = JSON.parse(line.slice(resultPrefix.length))
                  question = parsed.question ?? null
                  transcription = parsed.transcription ?? null
                  callSid = parsed.call_sid ?? null
                } catch { /* ignore parse errors */ }
                break
              }
            }

            res.statusCode = 200
            res.end(
              JSON.stringify({
                status: 'ok',
                message: 'Survey call completed.',
                surveyId,
                question,
                transcription,
                callSid,
              })
            )
          })
        })

        req.on('error', (error) => {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ detail: `Request stream failed: ${error.message}` }))
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), survoseRunApiPlugin()],
})
