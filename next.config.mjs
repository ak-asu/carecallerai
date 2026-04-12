import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
	outputFileTracingRoot: process.cwd(),
	webpack: (config) => {
		config.resolve ??= {}
		config.resolve.alias ??= {}

		// Natural has optional native deps we do not use in this app.
		config.resolve.alias.lapack = false
		config.resolve.alias['webworker-threads'] = false

		return config
	},
}

export default withNextIntl(nextConfig)
