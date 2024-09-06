const UserModel = require('../models/User')
const BasketModel = require('../models/Basket')
const ApiError = require('../error/error')
const bcrypt = require('bcrypt')
const RoleModel = require('../models/Role')
const OldViewsModel = require('../models/OldViews')
const SaveListModel = require('../models/SaveModel')
const GoogleUserModel = require('../models/GoogleUser')
const nodemailer = require('nodemailer')
const uuid = require('uuid')
const validator = require('validator')
const sanitizedData = require('../helpers/sanitizedHelpers')

class UserController {
	async login(req, res, next) {
		res.setHeader('Cache-Control', 's-max-age=1, stale-while-revalidate')
		let { email, password } = req.body

		const isValidEmail = sanitizedData(email)
		const isValidPassword = sanitizedData(password)
		const countFailAuth = sanitizedData(req.cookies.countFailAuth) || {
			count: 0,
			blockAuth: 0,
		}

		try {
			if (
				isValidEmail.length === 0 ||
				!validator.isEmail(isValidEmail) ||
				isValidPassword.length === 0 ||
				!countFailAuth
			) {
				return next(ApiError.unauthorized('Некоректні поля'))
			}

			if (countFailAuth.count >= 4 && countFailAuth.blockAuth > Date.now()) {
				const timeLeft = Math.ceil(
					(countFailAuth.blockAuth - Date.now()) / 1000 / 60
				)
				return next(
					ApiError.retryAfter(
						`Перевищено кількість спроб авторизації, буде доступно через ${timeLeft} хвилини`
					)
				)
			} else if (
				countFailAuth.count >= 4 &&
				countFailAuth.blockAuth < Date.now()
			) {
				countFailAuth.count = 0
				countFailAuth.blockAuth = 0
			}

			const user = await UserModel.findOne({ email: isValidEmail })
			if (!user) {
				return next(ApiError.unauthorized('Користувача з таким email не існує'))
			}

			const checkValidPassword = bcrypt.compareSync(
				isValidPassword,
				user.password
			)

			if (!checkValidPassword) {
				if (countFailAuth.count < 3) {
					res.cookie(
						'countFailAuth',
						{ count: countFailAuth.count + 1, blockAuth: 0 },
						{ httpOnly: true, maxAge: 240000, secure: true, sameSite: 'None' }
					)

					return next(ApiError.unauthorized('Невірний пароль або email'))
				} else {
					const date = new Date()
					res.cookie(
						'countFailAuth',
						{ count: 4, blockAuth: date.setMinutes(date.getMinutes() + 3) },
						{ httpOnly: true, maxAge: 240000, secure: true, sameSite: 'None' }
					)
					return next(
						ApiError.retryAfter(
							'Перевищена кількість спроб авторизації, буде доступно через 3 хвилини'
						)
					)
				}
			}

			res.cookie(
				'countFailAuth',
				{ count: countFailAuth.count, blockAuth: 0 },
				{ httpOnly: true, maxAge: 240000, secure: true, sameSite: 'None' }
			)

			return res.json(user)
		} catch (e) {
			console.log('Login error:', e)
			return next(ApiError.internal('Виникла помилка на сервері'))
		}
	}

	async registration(req, res, next) {
		try {
			res.setHeader('Cache-Control', 's-max-age=1, stale-while-revalidate')

			let { email, username, password } = req.body

			if (!username || !password || !email) {
				return next(ApiError.unauthorized('Некоректні поля'))
			}

			const isValidEmail = sanitizedData(email)
			const isValidUsername = sanitizedData(username)
			const isValidPassword = sanitizedData(password)

			if (
				isValidEmail.length === 0 ||
				!validator.isEmail(isValidEmail) ||
				isValidUsername.length === 0 ||
				isValidPassword.length === 0
			) {
				return next(ApiError.unauthorized('Некоректні поля'))
			}

			if (isValidUsername.length === 0 || isValidUsername.length > 20) {
				return next(
					ApiError.unauthorized(
						'ваш логін має неприпустиму кількість символів, він має складатися з 1-20 символів'
					)
				)
			}

			if (isValidPassword.length < 6) {
				return next(ApiError.unauthorized('пароль має бути від 6 символів'))
			}

			const hashPassword = bcrypt.hashSync(isValidPassword, 5)

			const roleAdmin = await RoleModel.findOne({ role: 'User' })

			const user = new UserModel({
				email: isValidEmail,
				username: isValidUsername,
				password: hashPassword,
				role: roleAdmin.role,
			})
			await user.save()

			const basketUsers = new BasketModel({ userId: user._id })
			await basketUsers.save()

			const oldViews = new OldViewsModel({ userId: user._id })
			await oldViews.save()

			const userSaveList = await new SaveListModel({ userId: user._id })
			await userSaveList.save()

			await UserModel.findByIdAndUpdate(user._id, {
				$set: { basketId: basketUsers._id },
			})

			return res.json(user)
		} catch (e) {
			console.log(e)
			return next(ApiError.internal('Виникла помилка на сервері'))
		}
	}

	async googleAuth(req, res, next) {
		try {
			res.setHeader('Cache-Control', 's-max-age=1, stale-while-revalidate')

			let { email, username, uid } = req.body

			if (!username || !email || !uid) {
				return next(ApiError.unauthorized('Помилка наданих полів'))
			}

			const isValidEmail = sanitizedData(email)
			const isValidUsername = sanitizedData(username)
			const isValidUid = sanitizedData(uid)

			if (
				isValidEmail.length === 0 ||
				isValidUsername.length === 0 ||
				isValidUid.length === 0
			) {
				return next(ApiError.unauthorized('Некоректні поля'))
			}

			const roleUser = await RoleModel.findOne({ role: 'User' })

			const user = new GoogleUserModel({
				uid: isValidUid,
				email: isValidEmail,
				username: isValidUsername,
				role: roleUser.role,
			})
			await user.save()

			const basketUsers = new BasketModel({ userId: user._id })
			await basketUsers.save()

			const oldViews = new OldViewsModel({ userId: user._id })
			await oldViews.save()

			const userSaveList = new SaveListModel({ userId: user._id })
			await userSaveList.save()

			await GoogleUserModel.findByIdAndUpdate(user._id, {
				$set: { basketId: basketUsers._id },
			})

			return res.json(user)
		} catch (e) {
			console.log(e.message)
			return next(ApiError.internal('Виникла помилка на сервері'))
		}
	}

	async getUserProfile(req, res) {
		try {
			res.setHeader('Cache-Control', 's-max-age=1, stale-while-revalidate')
			const token = req.token

			const user = await UserModel.findById(token.userId)
			if (!user) {
				const googleUser = await GoogleUserModel.findById(token.userId)
				if (!googleUser) {
					return res.json({ message: 'помилка клієнта, пройдіть авторизацію' })
				}

				const googleUserData = {
					username: googleUser.username,
					email: googleUser.email,
					firstname: googleUser.firstname || '',
					lastname: googleUser.lastname || '',
					surname: googleUser.surname || '',
					phone: googleUser.phone || undefined,
					birthday: googleUser.birthday || null,
				}

				return res.json(googleUserData)
			}

			const userData = {
				username: user.username,
				email: user.email,
				firstname: user.firstname || '',
				lastname: user.lastname || '',
				surname: user.surname || '',
				phone: user.phone || undefined,
				birthday: user.birthday || null,
			}

			return res.json(userData)
		} catch (e) {
			console.log(e.message)
			res.json({ message: e.message })
		}
	}

	async updateUserProfile(req, res, next) {
		try {
			res.setHeader('Cache-Control', 's-max-age=1, stale-while-revalidate')

			const { newValues } = req.body

			const isValidNewValues = sanitizedData(newValues)

			if (isValidNewValues.length === 0) {
				return next(ApiError.forbidden('Некоректні поля'))
			}

			const token = req.token

			const user = await UserModel.findById(token.userId)
			if (!user) {
				const googleUser = await GoogleUserModel.findById(token.userId)
				if (!googleUser) {
					return res.json({ message: 'помилка клієнта, пройдіть авторизацію' })
				}

				const result = await GoogleUserModel.findByIdAndUpdate(
					token.userId,
					isValidNewValues
				)
				if (!result) {
					return res.status(500).json('Виникла помилка')
				}
				return res.json('ok')
			}

			const result = await UserModel.findByIdAndUpdate(
				token.userId,
				isValidNewValues
			)
			if (!result) {
				return res.status(500).json('виникла помилка')
			}

			return res.json('ok')
		} catch (e) {
			console.log(e.message)
			res.json({ message: e.message })
		}
	}

	async passwordForgot(req, res, next) {
		try {
			res.setHeader('Cache-Control', 's-max-age=1, stale-while-revalidate')

			const { email } = req.body

			const isValidEmail = sanitizedData(email)

			if (isValidEmail.length === 0 || !validator.isEmail(isValidEmail)) {
				return res.json('такої пошти не існує')
			}

			const user = await UserModel.findOne({ email: isValidEmail })
			if (!user) {
				return res.json('такої пошти не існує')
			}

			const hashLink = uuid.v4() + uuid.v4()
			const transporter = nodemailer.createTransport({
				service: 'gmail',
				auth: {
					type: 'password',
					user: process.env.EMAIL,
					pass: process.env.PASSWORD,
				},
			})

			const mailOptions = {
				from: process.env.EMAIL,
				to: isValidEmail,
				subject: 'Відновлення паролю',
				text: `<div>Lin Store відновлення паролю</div>`,
				html: `
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <meta http-equiv="X-UA-Compatible" content="IE=edge">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Відновлення паролю</title>
                    </head>
                    <body style="font-family: 'Arial', sans-serif; margin: 0; padding: 0;">
                    
                        <div style="max-width: 800px; margin: 20px auto; padding: 20px; background-color: #f4f4f4; border-radius: 10px; box-shadow: 0 0 10px rgba(145,141,141,0.1);">
                            <p style="color: #555;">Ви отримали цей лист, тому що запросили відновлення пароля для вашого облікового запису.</p>
                            <p style="color: #555;">Щоб продовжити процес, натисніть наступне посилання для відновлення пароля:</p>
                            <a href="${process.env.CLIENT_APP}auth/recoveryPassword/${hashLink}" style="display: block; margin-top: 10px; padding: 10px; background-color: #007bff; color: #fff; text-decoration: none; border-radius: 5px; text-align: center;">Відновити пароль</a>
                            <p style="color: #555;">Якщо це були не ви, проігноруйте це повідомлення.</p>
                            <p style="color: #555; margin-top: 20px;">Посилання дійсне 3 хвилини з моменту відправки.</p>
                        </div>
                    </body>
                </html>`,
			}

			const updatePasswordDate = new Date(Date.now() + 3 * 60 * 1000)

			await UserModel.findOneAndUpdate(
				{ email: isValidEmail },
				{ hashUpdatePassword: hashLink, updatePasswordDate }
			)

			await transporter.sendMail(mailOptions)

			return res.json('ok')
		} catch (e) {
			console.log({ message: e.message })
		}
	}

	async checkRecoveryLink(req, res, next) {
		try {
			res.setHeader('Cache-Control', 's-max-age=1, stale-while-revalidate')

			const hashLink = req.params.link.slice(1)
			const currentDate = Date.now()

			const isValidHashLink = sanitizedData(hashLink)

			if (isValidHashLink.length === 0) {
				return next(ApiError.badRequest('Некоректні поля'))
			}

			const user = await UserModel.findOne({
				hashUpdatePassword: isValidHashLink,
			})
			if (!user) {
				return next(ApiError.badRequest('Це посилання більше не дійсне'))
			}

			const isExpiredDate = user.updatePasswordDate
			if (isExpiredDate < currentDate) {
				return next(
					ApiError.badRequest(
						'час на оновлення пароля минув, повторіть спробу знову'
					)
				)
			}

			return res.json('ok')
		} catch (e) {
			console.log({ message: e.message })
		}
	}

	async updatePassword(req, res, next) {
		try {
			res.setHeader('Cache-Control', 's-max-age=1, stale-while-revalidate')

			const { password } = req.body
			const hashLink = req.params.link.slice(1)
			const currentDate = Date.now()

			const isValidPassword = sanitizedData(password)
			const isValidHashLink = sanitizedData(hashLink)

			if (isValidPassword.length === 0 || isValidHashLink.length === 0) {
				return next(ApiError.badRequest('Некоректні поля'))
			}

			if (!password) {
				return next(ApiError.badRequest('Некоректні поля'))
			}
			const hashPassword = bcrypt.hashSync(isValidPassword, 5)

			const user = await UserModel.findOne({
				hashUpdatePassword: isValidHashLink,
			})
			if (!user) {
				return next(ApiError.badRequest('Такого користувача не існує'))
			}

			const isExpiredDate = user.updatePasswordDate
			if (isExpiredDate < currentDate) {
				return next(
					ApiError.badRequest(
						'час на оновлення пароля минув, повторіть спробу знову'
					)
				)
			}

			await UserModel.findOneAndUpdate(
				{ hashUpdatePassword: isValidHashLink },
				{
					hashUpdatePassword: '',
					updatePasswordDate: 0,
					password: hashPassword,
					$push: { oldPasswords: user.password },
				}
			)

			return res.json(`ok`)
		} catch (e) {
			console.log({ message: e.message })
		}
	}
}

module.exports = new UserController()
