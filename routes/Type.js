const Router = require('express')
const router = new Router()
const typeController = require('../controllers/typeController')
const checkRole = require('../middleware/checkRole')
const { default: helmet } = require('helmet')

router.use(helmet())
router.get('/', typeController.getAllTypes)
router.get('/:id', typeController.getOneType)
router.post('/', checkRole('Admin'), typeController.createType)

module.exports = router
