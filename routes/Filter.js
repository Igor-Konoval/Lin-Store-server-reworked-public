// const Router = require('express')
// const router = new Router()
// const filterController = require('../controllers/filterController')

// router.get('/', filterController.getFilter)

// module.export = router

const Router = require('express')
const router = new Router()
const filterController = require('../controllers/filterController')

router.get('/', filterController.getFilter)

module.exports = router
