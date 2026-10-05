import Application from 'test-app-ember-classic/app'
import config from 'test-app-ember-classic/config/environment'
import * as QUnit from 'qunit'
import { setApplication } from '@ember/test-helpers'
import { install } from '@harnessed-ts/qunit'
import { setupEmberOnerrorValidation } from 'ember-qunit'
// ember-exam's start wraps ember-qunit's: split, partition, random and load
// balancing come from the URL `ember exam` builds, and a plain `ember test`
// runs everything as before.
import { start } from 'ember-exam/test-support'

setApplication(Application.create(config.APP))

install(QUnit)
setupEmberOnerrorValidation()
start()
