const Router = require('express')
const router = new Router()
const searchController = require('../controllers/searchController')
const { default: helmet } = require('helmet')

router.use(helmet())
router.get('/shortSearch', searchController.shortSearch)

module.exports = router
