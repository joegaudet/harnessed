import Application from 'test-app-ember-vite/app'
import config from 'test-app-ember-vite/config/environment'
import * as QUnit from 'qunit'
import { setApplication } from '@ember/test-helpers'
import { install } from '@harnessed-ts/qunit'
import { start as qunitStart, setupEmberOnerrorValidation } from 'ember-qunit'

export function start() {
  setApplication(Application.create(config.APP))

  install(QUnit)
  setupEmberOnerrorValidation()

  qunitStart()
}
