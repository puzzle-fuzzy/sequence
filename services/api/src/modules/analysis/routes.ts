import { Elysia, t } from 'elysia'
import { createAuthPlugin } from '../../plugins/auth'
import { createAnalysisProject, listUserProjects, getProjectWithSteps, runStep, getStepResult } from './service'

export function createAnalysisRoutes(secret: string) {
  return new Elysia({ prefix: '/api/analysis' })
    .use(createAuthPlugin(secret))
    .post('/projects', ({ currentUser, body }) => createAnalysisProject(currentUser.id, body.videoUrl), {
      isAuth: true,
      body: t.Object({ videoUrl: t.String() }),
    })
    .get('/projects', ({ currentUser }) => listUserProjects(currentUser.id), { isAuth: true })
    .get('/projects/:id', ({ currentUser, params }) => getProjectWithSteps(currentUser.id, params.id), { isAuth: true })
    .post(
      '/projects/:id/steps/:step/run',
      ({ currentUser, params }) => runStep(currentUser.id, params.id, params.step as 'asr' | 'script'),
      { isAuth: true },
    )
    .get(
      '/projects/:id/steps/:step',
      ({ currentUser, params }) => getStepResult(currentUser.id, params.id, params.step as 'asr' | 'script'),
      { isAuth: true },
    )
}
