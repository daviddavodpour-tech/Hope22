import 'dart:io';
import 'package:file_picker/file_picker.dart';

class EvidencePicker {
  Future<File?> pickFile() async {
    final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'txt']);
    if (result == null || result.files.isEmpty) return null;
    final path = result.files.first.path;
    return path == null ? null : File(path);
  }
}
