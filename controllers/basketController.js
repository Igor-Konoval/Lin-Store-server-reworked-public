const BasketModel = require('../models/Basket')
const ProductModel = require('../models/Product')
const sanitizedData = require('../helpers/sanitizedHelpers')

class basketController {
	async getBasket(req, res) {
		try {
			const token = req.token

			const basketUser = await BasketModel.findOne({ userId: token.userId })

			if (!basketUser) {
				return res
					.status(404)
					.json({ error: 'Корзина пользователя не найдена' })
			}

			const productsId = basketUser.products.map(product => product.productId)

			const productList = await ProductModel.find({ _id: { $in: productsId } })

			const productListWithColor = productList
				.map(product => {
					const selectedProducts = basketUser.products.filter(item =>
						item.productId.equals(product._id)
					)

					const productsWithColors = selectedProducts.map(selectedProduct => ({
						...product.toObject(),
						selectedColor: selectedProduct.color,
						selectedImg: selectedProduct.selectedImg,
					}))

					return productsWithColors
				})
				.flat() 

			res.setHeader('Cache-Control', 's-max-age=1, stale-while-revalidate')
			return res.json(productListWithColor)
		} catch (e) {
			res.status(500).json({ error: e.message })
		}
	}

	async setBasket(req, res) {
		try {
			const { selectedProduct, selectedColor, selectedImg } = req.body
			const token = req.token

			const isValidColor = sanitizedData(selectedColor)
			const isValidProduct = sanitizedData(selectedProduct)
			const isValidImg = sanitizedData(selectedImg)

			if (!isValidProduct || !isValidColor) {
				return res.status(403).json({
					error: {
						title: 'Некоректні дані',
						data: 'На жаль, введені дані заборонені у використанні',
					},
				})
			}

			const product = await ProductModel.findById(isValidProduct)

			if (!product) {
				return res.status(404).json('даного товару не існує')
			}

			const checkProduct = await BasketModel.findOne({
				userId: token.userId,
				products: {
					$elemMatch: { productId: isValidProduct, color: isValidColor },
				},
			})

			if (checkProduct) {
				return res.json('цей товар вже доданий до кошика')
			}

			await BasketModel.findOneAndUpdate(
				{ userId: token.userId },
				{
					$push: {
						products: {
							productId: isValidProduct,
							color: isValidColor,
							selectedImg: isValidImg !== undefined ? isValidImg : 'none',
						},
					},
				},
				{ upsert: true, new: true }
			)

			res.setHeader('Cache-Control', 's-max-age=1, stale-while-revalidate')
			res.json('товар доданий до кошика')
		} catch (e) {
			res.status(500).json(e.message)
		}
	}

	async dropBasket(req, res) {
		try {
			const { selectedProduct, selectedColor } = req.body

			const token = req.token

			const isValidColor = sanitizedData(selectedColor)
			const isValidProduct = sanitizedData(selectedProduct)

			if (isValidProduct.length === 0 || isValidColor.length === 0) {
				return res.status(403).json({
					error: {
						title: 'Некоректні дані',
						data: 'На жаль, введені дані заборонені у використанні',
					},
				})
			}

			const product = await ProductModel.findById(isValidProduct)

			const basketUser = await BasketModel.findOneAndUpdate(
				{ userId: token.userId },
				{
					$pull: {
						products: { productId: isValidProduct, color: isValidColor },
					},
				}
			)
			res.setHeader('Cache-Control', 's-max-age=1, stale-while-revalidate')
			res.json(product)
		} catch (e) {
			res.json(e.message)
		}
	}
}

module.exports = new basketController()
