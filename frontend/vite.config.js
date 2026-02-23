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
          if (!rawBody.trim()) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ detail: 'Request body is required.' }))
            return
          }

          let payload = null
          let surveyId = null
          try {
            payload = JSON.parse(rawBody)
          } catch (_error) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ detail: 'Request body must be valid JSON.' }))
            return
          }

          if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ detail: 'Request body must be a JSON object.' }))
            return
          }

          surveyId = payload?.surveyId ?? null

          const python = spawn('python3', [survoseScriptPath], {
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

          python.stdin.write(rawBody)
          python.stdin.end()

          python.on('close', (code) => {
            res.setHeader('Content-Type', 'application/json')

            if (code !== 0) {
              const detail = (stderr || stdout || `survose.py failed with exit code ${code}`).trim()
              const isUserInputError = detail.includes('USER_INPUT_ERROR:')
              res.statusCode = isUserInputError ? 400 : 500
              res.end(JSON.stringify({ detail }))
              return
            }

            let question = null
            let questionJson = null
            let transcription = null
            let callSid = null
            const resultPrefix = 'SURVOSE_RESULT:'
            for (const line of stdout.split('\n')) {
              if (line.startsWith(resultPrefix)) {
                try {
                  const parsed = JSON.parse(line.slice(resultPrefix.length))
                  question = parsed.questions ?? null
                  questionJson = parsed.question_json ?? parsed.survey_json ?? null
                  transcription = parsed.transcriptions ?? null
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
                questionJson,
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
