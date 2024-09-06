const Router = require('express')
const router = new Router()
const saveListController = require('../controllers/saveListController')
const authCheck = require('../middleware/authCheck')
const { default: helmet } = require('helmet')

router.use(helmet())
router.get('/', authCheck, saveListController.getSaveList)
router.get('/:id', authCheck, saveListController.checkProduct)
router.post('/', authCheck, saveListController.setSaveList)
router.delete('/:id', authCheck, saveListController.removeSaveList)

module.exports = router
