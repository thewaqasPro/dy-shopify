export const PRODUCT_BY_CUSTOM_ID = /* GraphQL */ `
  query ProductByCustomId($namespace: String!, $key: String!, $value: String!) {
    productByIdentifier(identifier: { customId: { namespace: $namespace, key: $key, value: $value } }) {
      id
      title
      handle
      status
      vendor
      variants(first: 10) {
        nodes {
          id
          sku
          barcode
          price
        }
      }
      media(first: 20) {
        nodes {
          id
          alt
          mediaContentType
          status
        }
      }
    }
  }
`;

export const PRODUCT_SET = /* GraphQL */ `
  mutation UpsertBossLogicsProduct(
    $input: ProductSetInput!
    $identifier: ProductSetIdentifiers!
    $synchronous: Boolean!
  ) {
    productSet(input: $input, identifier: $identifier, synchronous: $synchronous) {
      product {
        id
        title
        handle
        status
        vendor
        variants(first: 10) {
          nodes {
            id
            sku
            barcode
            price
          }
        }
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

export const PRODUCT_CREATE_MEDIA = /* GraphQL */ `
  mutation CreateProductMedia($productId: ID!, $media: [CreateMediaInput!]!) {
    productCreateMedia(productId: $productId, media: $media) {
      media {
        id
        alt
        mediaContentType
        status
      }
      mediaUserErrors {
        field
        message
        code
      }
      product {
        id
      }
    }
  }
`;

export const CREATE_METAFIELD_DEFINITION = /* GraphQL */ `
  mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition {
        id
        name
        namespace
        key
        type {
          name
        }
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;
