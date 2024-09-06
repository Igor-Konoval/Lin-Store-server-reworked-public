const BrandModel = require('../models/Brand')
const TypeModel = require('../models/Type')

class FilterController {
	async getFilter(req, res) {
		try {
			const allBrand = await BrandModel.find({})
			const allTypes = await TypeModel.find({})

			return res.json({
				brands: allBrand,
				types: allTypes,
			})
		} catch (e) {
			return res.json({ message: e })
		}
	}
}

module.exports = new FilterController()
