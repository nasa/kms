import status from "../handler"

beforeEach(() => {
  vi.clearAllMocks()
})

describe('status', () => {
  test('returns a 200 status code', async () => {
    const response = await status()

    expect(response.statusCode).toBe(200)
    expect(response.body).toBe('healthy')
  })
})
