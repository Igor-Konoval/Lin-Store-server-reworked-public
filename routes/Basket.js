const Router = require('express')
const router = new Router()
const basketController = require('../controllers/basketController')
const authCheck = require('../middleware/authCheck')
const { default: helmet } = require('helmet')

router.use(helmet())
router.get('/basketUser', authCheck, basketController.getBasket)
router.post('/basketUser', authCheck, basketController.setBasket)
router.post('/dropBasketUser', authCheck, basketController.dropBasket)

module.exports = router
