// Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// //
// Permission is hereby granted, free of charge, to any person obtaining a copy of this
// software and associated documentation files (the "Software"), to deal in the Software
// without restriction, including without limitation the rights to use, copy, modify,
// merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so.
// //
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
// INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
// PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
// HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
// SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

const model = {
    "type": "create-products",
    "data": {
      "imageUrl": "someimageURL",
      "baseProductIds": [1,2,3]
    }
  }
  
  const AWS = require('aws-sdk');
  const eventbridge = new AWS.EventBridge();

  
  
  exports.lambdaHandler = async (event) => {
    try {
      let requestData = JSON.parse(event.body)
      const { type, data: { merchName, selectedBaseProduct, selectedUserImages, selectedImagePlacement }} = requestData
      const printfulRequests = []
      for(let selectedUserImage of selectedUserImages) {
        const variants = selectedBaseProduct.variants.map((variant) => ({ 
          variant_id: variant.id,
          retail_price: calculateRetailPrice(variant, selectedImagePlacement),
          files: [
            {
              type: selectedImagePlacement.id,
              url: selectedUserImage.metadata.image
            }
          ] 
        }))

        const printfulRequest = {
          sync_product: {
            name: `${selectedUserImage.metadata.name} - ${merchName}`
          },
          sync_variants: variants
        }

        printfulRequests.push(printfulRequest)
      }

      const eventDetails = {
        printfulRequests,
        selectedBaseProduct,
        selectedUserImages,
        selectedImagePlacement
      }

      let params = {
        Entries: [{
          Detail: JSON.stringify(eventDetails),
          DetailType: 'create-products',
          Source: "ProductEndpoint",
          EventBusName: process.env.EVENT_BUS_NAME
        }]
      }
  
      if (requestData) await eventbridge.putEvents(params).promise()
  
      return {
        "message": "Request received"
      }
    } catch (err) {
      console.log(err.message);
      return {
        "message": "Error submitting data",
        "error": err.message
      }
    }
  }

  function calculateRetailPrice(variant, selectedImagePlacement) {
    const retailPrice = (+variant.price + +selectedImagePlacement.additional_price + ((+variant.price + +selectedImagePlacement.additional_price) * .5)).toFixed(2)
    const retailPriceString = retailPrice.toString()

    return retailPriceString
}