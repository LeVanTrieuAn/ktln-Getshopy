/**
 * LỚP TOKENIZER (BỘ TÁCH TỪ VÀ CHUẨN HÓA VĂN BẢN)
 * @description Lớp này chịu trách nhiệm tiền xử lý ngôn ngữ tự nhiên (NLP) trước khi đưa vào thuật toán Học máy.
 * Hoàn toàn tự viết (Zero-Dependency) phục vụ cho Đồ án Khóa luận Tốt nghiệp.
 */
class Tokenizer {
  constructor() {
    // Tập hợp các Stop-words (Từ dừng) trong tiếng Việt thường dùng trong giao tiếp mua bán.
    // Các từ này không mang giá trị phân loại ý định, nên xóa đi để mô hình học nhanh và chính xác hơn.
    this.stopWords = new Set([
      'là', 'và', 'của', 'những', 'các', 'một', 'để', 'cho', 'với', 'thì', 'mà', 
      'như', 'này', 'kia', 'đó', 'đây', 'tại', 'bị', 'được', 'do', 'bởi', 
      'ạ', 'nhé', 'nha', 'đi', 'nào', 'vậy', 'ơi', 'hả'
    ]);
  }

  /**
   * Hàm chuẩn hóa chữ Tiếng Việt:
   * 1. Chuyển hết thành chữ thường (Lowercase)
   * 2. Xóa bỏ dấu câu, ký tự đặc biệt
   * (Lưu ý: Chúng ta GIỮ LẠI dấu tiếng việt (á, à) để phân biệt ý nghĩa, ví dụ "giá" khác "gia")
   */
  normalize(text) {
    if (!text) return '';
    return text.toString().toLowerCase()
      // Xóa dấu câu (.,!?;:'"()[]{})
      .replace(/[.,!?;:'"()\[\]{}]/g, ' ')
      // Xóa nhiều khoảng trắng thừa thành 1 khoảng trắng
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Cắt câu thành từng từ riêng biệt (Token)
   */
  tokenize(text) {
    const normalizedText = this.normalize(text);
    if (!normalizedText) return [];
    
    // Tách từ dựa trên khoảng trắng
    const words = normalizedText.split(' ');
    
    // Loại bỏ các Stop words
    return words.filter(word => word.length > 0 && !this.stopWords.has(word));
  }
}

module.exports = Tokenizer;
