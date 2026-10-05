import Application from 'test-app-ember-classic/app'
import config from 'test-app-ember-classic/config/environment'
import * as QUnit from 'qunit'
import { setApplication } from '@ember/test-helpers'
import { install } from '@harnessed-ts/qunit'
import { loadTests } from 'ember-qunit/test-loader'
import { start, setupEmberOnerrorValidation } from 'ember-qunit'

setApplication(Application.create(config.APP))

install(QUnit)
setupEmberOnerrorValidation()
loadTests()
start()
