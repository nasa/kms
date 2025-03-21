/**
 * @fileoverview Utility functions for making HTTP requests to the CMR (Common Metadata Repository) API.
 *
 * This module provides two main functions:
 * - cmrPostRequest: For making POST requests to the CMR API
 * - cmrGetRequest: For making GET requests to the CMR API
 *
 * Both functions use the CMR_BASE_URL environment variable to determine the base URL for the CMR API.
 *
 * @module cmrRequest
 * @requires node-fetch
 *
 * @example
 * // POST request
 * import { cmrPostRequest } from './cmrRequest';
 *
 * cmrPostRequest({
 *   path: '/search/collections',
 *   body: JSON.stringify({ query: { keyword: 'MODIS' } }),
 *   contentType: 'application/json',
 *   accept: 'application/json'
 * }).then(response => response.json())
 *   .then(data => console.log(data))
 *   .catch(error => console.error('Error:', error));
 *
 * @example
 * // GET request
 * import { cmrGetRequest } from './cmrRequest';
 *
 * cmrGetRequest({
 *   path: '/search/collections?keyword=MODIS'
 * }).then(response => response.json())
 *   .then(data => console.log(data))
 *   .catch(error => console.error('Error:', error));
 *
 */

export const cmrPostRequest = async ({
  path,
  body,
  contentType = 'application/json',
  accept = 'application/json'
}) => {
  const getCmrEndpoint = () => {
    const baseUrl = process.env.CMR_BASE_URL

    return `${baseUrl}`
  }

  const endpoint = getCmrEndpoint()

  const fetchOptions = {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
      Accept: accept
    }
  }

  // Only add the body to fetchOptions if it's not empty or null
  if (body && body !== '') {
    fetchOptions.body = body
  }

  return fetch(`${endpoint}${path}`, fetchOptions)
}

export const cmrGetRequest = async ({
  path
}) => {
  const getCmrEndpoint = () => {
    const baseUrl = process.env.CMR_BASE_URL

    return `${baseUrl}`
  }

  const endpoint = getCmrEndpoint()

  const fetchOptions = {
    method: 'GET'
  }

  return fetch(`${endpoint}${path}`, fetchOptions)
}
